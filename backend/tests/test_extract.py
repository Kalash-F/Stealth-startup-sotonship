"""Phase 2: PDF -> Invoice. Accuracy against the 60 synthetic truth files, LLM plumbing (retry,
fallback, cache) against a fake client, and the small parsers."""

from __future__ import annotations

import json
import subprocess
import sys
from collections import defaultdict

import pytest
from weasyprint import HTML

from tbml.extract import extract_document
from tbml.extract.address import classify_address
from tbml.extract.countries import country_code, country_from_address
from tbml.extract.layout import parse_date
from tbml.extract.numbers import parse_number
from tbml.extract.scoring import compare, norm, summarise
from tbml.paths import SYNTHETIC_DIR
from tbml.schemas import AddressType, Invoice

PDFS = sorted((SYNTHETIC_DIR / "pdfs").glob("*.pdf"))


def truth_of(pdf) -> Invoice:
    return Invoice.model_validate_json((SYNTHETIC_DIR / "truth" / f"{pdf.stem}.json").read_text())


class FakeClient:
    """Stands in for the Anthropic client. `replies` are returned in order, then repeated."""

    model = "fake-model"

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = 0
        self.last_messages = None

    def complete(self, system, messages):
        self.calls += 1
        self.last_messages = messages
        reply = self.replies[min(self.calls, len(self.replies)) - 1]
        return reply(messages) if callable(reply) else reply


def truth_reply(pdf):
    return json.dumps(truth_of(pdf).model_dump(mode="json"))


@pytest.fixture(autouse=True)
def no_real_llm(monkeypatch, tmp_path):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path / "cache"))
    monkeypatch.setattr("tbml.extract.llm._load_dotenv", lambda: None)


# ---------------------------------------------------------------- accuracy (2.6)


@pytest.fixture(scope="module")
def layout_results(tmp_path_factory):
    root = tmp_path_factory.mktemp("cache")
    results, outputs = [], {}
    for pdf in PDFS:
        out = extract_document(pdf, use_llm=False, cache_root=root)
        outputs[pdf.name] = out
        results += compare(truth_of(pdf), out.invoice)
    return results, outputs


def test_all_60_pdfs_present():
    assert len(PDFS) == 60


def test_every_output_validates_as_invoice(layout_results):
    _, outputs = layout_results
    for name, out in outputs.items():
        assert out.method == "layout", name
        Invoice.model_validate_json(out.invoice.model_dump_json())


def test_numeric_fields_at_least_98_percent(layout_results):
    ok, n = summarise(layout_results[0])["strict"]
    assert ok / n >= 0.98, f"{ok}/{n}"


def test_other_fields_at_least_95_percent(layout_results):
    ok, n = summarise(layout_results[0])["other"]
    assert ok / n >= 0.95, f"{ok}/{n}"


def test_no_template_is_left_behind(layout_results):
    """Misses must not cluster in one template (plan Checkpoint 2)."""
    templates = {}
    for line in (SYNTHETIC_DIR / "invoices.csv").read_text().splitlines()[1:]:
        cols = line.split(",")
        templates[cols[0]] = cols[4]
    by_template = defaultdict(lambda: [0, 0])
    for r in layout_results[0]:
        t = by_template[templates[r.invoice_id]]
        t[0] += r.ok
        t[1] += 1
    assert set(by_template) == {"classic", "modern", "trade"}
    for name, (ok, n) in by_template.items():
        assert ok / n >= 0.95, f"{name}: {ok}/{n}"


def test_planted_arithmetic_errors_are_not_repaired(layout_results):
    """R6 needs the printed (wrong) numbers, so extraction must not fix them."""
    labels = (SYNTHETIC_DIR / "labels.csv").read_text().splitlines()[1:]
    ids = sorted({line.split(",")[0] for line in labels if "ARITHMETIC_ERROR" in line})
    assert ids
    outputs = layout_results[1]
    for pdf_id in ids:
        got = outputs[f"{pdf_id}.pdf"].invoice
        truth = truth_of(PDFS[[p.stem for p in PDFS].index(pdf_id)])
        assert got.stated_total == pytest.approx(truth.stated_total, abs=0.01)
        assert [i.line_total for i in got.line_items] == pytest.approx(
            [i.line_total for i in truth.line_items], abs=0.01
        )


def test_clean_documents_have_full_confidence_and_no_warnings(layout_results):
    for name, out in layout_results[1].items():
        assert out.warnings == [], name
        assert all(i.extraction_confidence == 1.0 for i in out.invoice.line_items), name


# ---------------------------------------------------------------- LLM path, retry, cache


def test_llm_path_then_cache_makes_zero_calls(tmp_path):
    """Second run over all 60 PDFs is served from the file-hash cache: no LLM call, same output."""
    client = FakeClient([])
    first = {}
    for pdf in PDFS:
        client.replies = [truth_reply(pdf)]
        client.calls = 0
        out = extract_document(pdf, client=client, cache_root=tmp_path)
        assert (out.method, out.llm_calls, client.calls) == ("llm", 1, 1)
        first[pdf.name] = out.invoice
    spy = FakeClient([lambda m: pytest.fail("LLM called on a cache hit")])
    for pdf in PDFS:
        out = extract_document(pdf, client=spy, cache_root=tmp_path)
        assert out.method == "llm-cache" and out.llm_calls == 0
        assert out.invoice == first[pdf.name]
    assert spy.calls == 0


def test_cache_is_keyed_by_file_hash_not_name(tmp_path):
    pdf = PDFS[0]
    extract_document(pdf, client=FakeClient([truth_reply(pdf)]), cache_root=tmp_path)
    copy = tmp_path / "renamed.pdf"
    copy.write_bytes(pdf.read_bytes())
    out = extract_document(copy, client=FakeClient([]), cache_root=tmp_path)
    assert out.method == "llm-cache" and out.invoice.source_file == "renamed.pdf"


def test_cache_hit_needs_no_api_key(tmp_path):
    pdf = PDFS[1]
    extract_document(pdf, client=FakeClient([truth_reply(pdf)]), cache_root=tmp_path)
    assert extract_document(pdf, cache_root=tmp_path).method == "llm-cache"


def test_invalid_reply_is_retried_once_with_the_error(tmp_path):
    pdf = PDFS[2]
    client = FakeClient(["not json at all", truth_reply(pdf)])
    out = extract_document(pdf, client=client, cache_root=tmp_path)
    assert out.method == "llm" and out.llm_calls == 2
    retry_prompt = client.last_messages[-1]["content"]
    assert "failed validation" in retry_prompt and "no JSON object" in retry_prompt


def test_schema_violation_is_retried(tmp_path):
    pdf = PDFS[3]
    bad = json.loads(truth_reply(pdf))
    bad["currency"] = "dollars"
    client = FakeClient([json.dumps(bad), truth_reply(pdf)])
    out = extract_document(pdf, client=client, cache_root=tmp_path)
    assert out.llm_calls == 2
    assert "currency" in client.last_messages[-1]["content"]


def test_two_failures_fall_back_to_layout_with_warning_and_cache_nothing(tmp_path):
    pdf = PDFS[4]
    client = FakeClient(["nope", "still nope"])
    out = extract_document(pdf, client=client, cache_root=tmp_path)
    assert client.calls == 2 and out.method == "layout"
    assert any("failed validation twice" in w for w in out.warnings)
    assert compare(truth_of(pdf), out.invoice) and all(
        r.ok for r in compare(truth_of(pdf), out.invoice)
    )
    assert not (tmp_path / "llm").exists()  # a failed structuring is not cached


def test_client_exception_degrades_to_layout(tmp_path):
    def boom(_):
        raise ConnectionError("network down")

    out = extract_document(PDFS[5], client=FakeClient([boom]), cache_root=tmp_path)
    assert out.method == "layout"
    assert any("ConnectionError" in w for w in out.warnings)


def test_number_not_in_document_is_flagged_and_lowers_confidence(tmp_path):
    pdf = PDFS[6]
    payload = json.loads(truth_reply(pdf))
    payload["line_items"][0]["quantity"] = 123456789.5
    out = extract_document(pdf, client=FakeClient([json.dumps(payload)]), cache_root=tmp_path)
    assert out.invoice.line_items[0].extraction_confidence == 0.5
    assert any("L1: quantity" in w for w in out.warnings)


def test_llm_address_type_is_overridden_by_decisive_keywords(tmp_path):
    pdf = next(
        p
        for p in PDFS
        if truth_of(p).consignee and truth_of(p).consignee.address_type == "residential"
    )
    payload = json.loads(truth_reply(pdf))
    payload["consignee"]["address_type"] = "commercial"
    out = extract_document(pdf, client=FakeClient([json.dumps(payload)]), cache_root=tmp_path)
    assert out.invoice.consignee.address_type == AddressType.residential


def test_source_file_and_synthetic_flag_come_from_the_file_not_the_model(tmp_path):
    pdf = PDFS[7]
    payload = json.loads(truth_reply(pdf))
    payload.update(source_file="evil.pdf", is_synthetic=False)
    out = extract_document(pdf, client=FakeClient([json.dumps(payload)]), cache_root=tmp_path)
    assert out.invoice.source_file == pdf.name and out.invoice.is_synthetic is True


def test_fenced_json_reply_is_accepted(tmp_path):
    pdf = PDFS[8]
    out = extract_document(
        pdf, client=FakeClient([f"```json\n{truth_reply(pdf)}\n```"]), cache_root=tmp_path
    )
    assert out.method == "llm" and out.llm_calls == 1


def test_raw_text_is_stored_for_debugging(tmp_path):
    out = extract_document(PDFS[0], use_llm=False, cache_root=tmp_path)
    stored = list((tmp_path / "raw_text").glob("*.txt"))
    assert len(stored) == 1 and out.invoice.invoice_id in stored[0].read_text()


# ---------------------------------------------------------------- degraded inputs


def _pdf(tmp_path, html):
    path = tmp_path / "x.pdf"
    HTML(string=html).write_pdf(path)
    return path


def test_unrecognised_layout_returns_valid_minimal_invoice_with_warning(tmp_path):
    out = extract_document(_pdf(tmp_path, "<p>Hello, this is a letter.</p>"), cache_root=tmp_path)
    assert out.method == "minimal" and out.invoice.line_items == []
    assert any("could not read" in w for w in out.warnings)
    Invoice.model_validate_json(out.invoice.model_dump_json())


def test_pdf_without_text_layer_warns(tmp_path):
    out = extract_document(_pdf(tmp_path, "<div></div>"), cache_root=tmp_path)
    assert out.method == "minimal" and any("no text layer" in w for w in out.warnings)


def test_cli_prints_valid_invoice_json():
    pdf = PDFS[0]
    proc = subprocess.run(
        [sys.executable, "-m", "tbml.extract", str(pdf), "--no-llm"],
        capture_output=True,
        text=True,
        check=True,
    )
    assert Invoice.model_validate_json(proc.stdout).invoice_id == truth_of(pdf).invoice_id


# ---------------------------------------------------------------- small parsers


@pytest.mark.parametrize(
    ("text", "value", "repaired"),
    [
        ("1,250", 1250.0, False),
        ("0.0454", 0.0454, False),
        ("786,954.96", 786954.96, False),
        ("12", 12.0, False),
        ("1.234,56", 1234.56, True),
        ("1234,5", 1234.5, True),
        ("1.234.567", 1234567.0, True),
        ("USD 99.5", 99.5, True),
        ("n/a", None, True),
    ],
)
def test_parse_number(text, value, repaired):
    assert parse_number(text) == (value, repaired)


@pytest.mark.parametrize(
    ("text", "iso"),
    [
        ("19 March 2024", "2024-03-19"),
        ("2024-07-04", "2024-07-04"),
        ("27/04/2024", "2024-04-27"),
        ("DD/MM/YYYY: 01/08/2024", "2024-08-01"),
        ("March 19, 2024", "2024-03-19"),
    ],
)
def test_parse_date(text, iso):
    assert str(parse_date(text)) == iso


def test_countries():
    assert country_code("Made in China") == "CN"
    assert country_code("U.A.E.") == "AE"
    assert country_from_address("Unit 9, Leicester LE97 3ZX, United Kingdom") == "GB"
    assert country_from_address("Areál X, Lipová 39, Prague, Czech Republic") == "CZ"
    assert country_from_address("somewhere") is None


@pytest.mark.parametrize(
    ("name", "address", "expected"),
    [
        ("Acme Ltd", "Unit 4, Foo Trading Estate, Leeds", AddressType.commercial),
        ("M. Smith", "Flat 3, 12 High Court, Bristol", AddressType.residential),
        ("Gulf Trading LLC", "P.O. Box 123, Dubai", AddressType.unknown),
        ("J. Doe", "12 Some Street, Leeds", None),
        ("Warehouse Co", "Warehouse 5, Plot 9, Jebel Ali", AddressType.commercial),
    ],
)
def test_address_type(name, address, expected):
    assert classify_address(name, address) == expected


def test_normalised_equality():
    assert norm("  WOMEN'S  T-Shirt ") == norm("women's t-shirt")
    assert norm(None) is None
