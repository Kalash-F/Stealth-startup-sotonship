"""Phase 5: the real pipeline over HTTP (extraction, classification, bands, rules, scoring)."""

import csv

import pytest
from fastapi.testclient import TestClient

import tbml.api as api
from tbml.api import app
from tbml.paths import SYNTHETIC_DIR
from tbml.schemas import PriorityBand, Report, Rule, Severity

client = TestClient(app)


@pytest.fixture(autouse=True)
def _reports_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_REPORTS_DIR", str(tmp_path / "reports"))
    monkeypatch.delenv("USE_MOCKS", raising=False)


def _pdf(invoice_id: str) -> bytes:
    return (SYNTHETIC_DIR / "pdfs" / f"{invoice_id}.pdf").read_bytes()


def _post(data: bytes, name: str = "invoice.pdf"):
    return client.post("/check", files={"file": (name, data, "application/pdf")})


def _planted(label: str) -> tuple[str, str]:
    with open(SYNTHETIC_DIR / "labels.csv", newline="") as f:
        for row in csv.DictReader(f):
            if row["label"] == label:
                return row["invoice_id"], row["line_id"]
    raise AssertionError(label)


def _clean_invoice() -> str:
    with open(SYNTHETIC_DIR / "invoices.csv", newline="") as f:
        return next(r["invoice_id"] for r in csv.DictReader(f) if r["role"] == "clean")


def test_health_reports_real_pipeline_and_mock_bands():
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["stubs"] is False
    assert body["benchmarks"] == "mock"  # until fetch_benchmarks.py has produced bands.json


def test_over_priced_invoice_flags_the_right_line():
    invoice_id, line_id = _planted("OVER_PRICE")
    resp = _post(_pdf(invoice_id))
    assert resp.status_code == 200
    report = Report.model_validate(resp.json())
    hits = [f for f in report.flags if f.rule == Rule.PRICE_OUTLIER and f.line_id == line_id]
    assert hits and hits[0].severity == Severity.high
    assert report.priority_band != PriorityBand.low
    assert report.processing_ms >= 0


def test_clean_invoice_is_low_priority():
    report = Report.model_validate(_post(_pdf(_clean_invoice())).json())
    assert report.priority_band == PriorityBand.low


def test_report_is_cached_and_retrievable():
    invoice_id = _clean_invoice()
    posted = _post(_pdf(invoice_id)).json()
    assert client.get(f"/reports/{invoice_id}").json() == posted
    assert client.get("/reports/NOPE-1").status_code == 404
    assert client.get("/reports/..%2Fsecret").status_code == 404


def test_samples_list_and_check_one():
    listing = client.get("/samples").json()
    assert len(listing) == 60
    assert {s["kind"] for s in listing} == {"clean", "anomalous", "hard_negative"}
    resp = client.post(f"/samples/{listing[0]['invoice_id']}/check")
    assert resp.status_code == 200
    assert client.post("/samples/not-a-sample/check").status_code == 404


def test_non_pdf_is_400():
    resp = _post(b"hello, this is not a pdf", "notes.txt")
    assert resp.status_code == 400
    assert "PDF" in resp.json()["detail"]


def test_corrupt_pdf_is_400_not_500():
    assert _post(b"%PDF-1.4 truncated garbage").status_code == 400


def test_pdf_without_text_returns_200_with_warnings():

    # The smallest valid PDF with one empty page and no text layer.
    empty = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
        b"trailer<</Root 1 0 R>>\n%%EOF"
    )
    resp = _post(empty)
    assert resp.status_code == 200
    assert resp.json()["warnings"]


def test_oversized_upload_is_413():
    resp = _post(b"%PDF-1.4\n" + b"0" * (api.MAX_UPLOAD_BYTES + 1))
    assert resp.status_code == 413


def test_use_mocks_runs_the_stub_pipeline(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "1")
    assert client.get("/health").json()["stubs"] is True
    resp = _post(b"%PDF-1.4 stub")
    assert resp.status_code == 200
    assert resp.json()["invoice_id"] == "INV-2024-0001"


def test_rule_skip_warnings_reach_report(monkeypatch):
    monkeypatch.setattr(
        "tbml.pipeline.run_rules_with_warnings", lambda inv, e, b: ([], ["R5 skipped: test"])
    )
    resp = _post(_pdf(_clean_invoice()))
    assert "R5 skipped: test" in resp.json()["warnings"]
