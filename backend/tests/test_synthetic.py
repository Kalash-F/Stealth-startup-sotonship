"""Phase 1: the synthetic dataset is reproducible, valid, and its labels are true."""

import csv
import io
import math
from collections import Counter

import pdfplumber
import pytest

from tbml.paths import SYNTHETIC_DIR
from tbml.schemas import Invoice
from tbml.synthetic import catalogue as cat
from tbml.synthetic.generator import (
    ANOMALY_TYPES,
    generate,
    invoices_csv,
    labels_csv,
    lines_csv,
)

SEED, N = 42, 60
TRUTH_DIR = SYNTHETIC_DIR / "truth"
PDF_DIR = SYNTHETIC_DIR / "pdfs"
# R6 tolerance: 0.5% or 1 currency unit. A planted error must exceed both; clean must be exact.
ARITH_TOL_REL, ARITH_TOL_ABS = 0.005, 1.0
ROUNDING = 0.01


def _rows(text: str) -> list[dict]:
    return list(csv.DictReader(io.StringIO(text)))


@pytest.fixture(scope="module")
def items():
    return generate(SEED, N)


@pytest.fixture(scope="module")
def bands():
    from tbml.synthetic.generator import DEFAULT_BANDS, load_route_bands

    return load_route_bands(DEFAULT_BANDS)


@pytest.fixture(scope="module")
def labels(items):
    return _rows(labels_csv(items))


def test_same_seed_is_byte_identical(items):
    again = generate(SEED, N)
    assert labels_csv(again) == labels_csv(items)
    assert lines_csv(again) == lines_csv(items)
    assert invoices_csv(again) == invoices_csv(items)
    for a, b in zip(items, again, strict=True):
        assert a.invoice.model_dump_json(indent=2) == b.invoice.model_dump_json(indent=2)


def test_different_seed_differs(items):
    assert labels_csv(generate(SEED + 1, N)) != labels_csv(items)


def test_committed_dataset_matches_generator(items):
    """data/synthetic is exactly what `generate_invoices.py --seed 42 --n 60` writes."""
    assert (SYNTHETIC_DIR / "labels.csv").read_text() == labels_csv(items)
    assert (SYNTHETIC_DIR / "lines.csv").read_text() == lines_csv(items)
    assert (SYNTHETIC_DIR / "invoices.csv").read_text() == invoices_csv(items)
    committed = sorted(p.name for p in TRUTH_DIR.glob("*.json"))
    assert committed == sorted(f"{g.invoice.invoice_id}.json" for g in items)
    for g in items:
        path = TRUTH_DIR / f"{g.invoice.invoice_id}.json"
        assert path.read_text() == g.invoice.model_dump_json(indent=2) + "\n"


def test_every_truth_file_validates_as_invoice():
    files = sorted(TRUTH_DIR.glob("*.json"))
    assert len(files) == N
    for path in files:
        inv = Invoice.model_validate_json(path.read_text())
        assert inv.is_synthetic is True
        assert inv.source_file == f"{inv.invoice_id}.pdf"
        assert 1 <= len(inv.line_items) <= 5


def test_ids_unique(items):
    ids = [g.invoice.invoice_id for g in items]
    assert len(set(ids)) == len(ids)


def test_anomaly_counts_and_shares(items, labels):
    counts = Counter(r["label"] for r in labels if r["label"])
    for label in ANOMALY_TYPES:
        assert counts[label] >= 4, label
    roles = Counter(g.role for g in items)
    assert roles["anomalous"] == round(0.3 * N)
    assert roles["hard_negative"] == round(0.1 * N)
    hard_rows = [r for r in labels if r["hard_negative"] == "CLEAN_HARD"]
    assert len(hard_rows) == roles["hard_negative"]
    assert all(r["label"] == "" for r in hard_rows)
    anomalous_ids = {r["invoice_id"] for r in labels if r["label"]}
    assert anomalous_ids == {g.invoice.invoice_id for g in items if g.role == "anomalous"}


def _arith_line_ok(qty: float, price: float, total: float) -> bool:
    return abs(qty * price - total) <= ROUNDING


def _arith_breaks_tolerance(expected: float, stated: float) -> bool:
    return abs(stated - expected) > max(ARITH_TOL_REL * abs(expected), ARITH_TOL_ABS)


def test_planted_arithmetic_errors_fail_arithmetic(items, labels):
    by_id = {g.invoice.invoice_id: g.invoice for g in items}
    rows = [r for r in labels if r["label"] == "ARITHMETIC_ERROR"]
    assert rows
    for r in rows:
        inv = by_id[r["invoice_id"]]
        if r["line_id"]:
            li = next(x for x in inv.line_items if x.line_id == r["line_id"])
            assert _arith_breaks_tolerance(li.quantity * li.unit_price, li.line_total)
        else:
            lines_sum = sum(x.line_total for x in inv.line_items)
            assert _arith_breaks_tolerance(lines_sum, inv.stated_total)


def test_invoices_without_arithmetic_label_pass_arithmetic(items, labels):
    planted = {r["invoice_id"] for r in labels if r["label"] == "ARITHMETIC_ERROR"}
    for g in items:
        inv = g.invoice
        if inv.invoice_id in planted:
            continue
        for li in inv.line_items:
            assert _arith_line_ok(li.quantity, li.unit_price, li.line_total), inv.invoice_id
        assert abs(sum(x.line_total for x in inv.line_items) - inv.stated_total) <= ROUNDING


def test_planted_prices_sit_where_labels_say(items, bands):
    roles = {g.invoice.invoice_id: g for g in items}
    for r in _rows(lines_csv(items)):
        g = roles[r["invoice_id"]]
        route = f"{g.invoice.seller.country}-{g.invoice.buyer.country}"
        b = bands.get((r["true_hs6"], route)) or bands[(r["true_hs6"], None)]
        usd = float(r["unit_price_usd"])
        where = f"{r['invoice_id']} {r['line_id']} {r['label']} {usd}"
        if r["label"] == "OVER_PRICE":
            assert usd >= 2 * b.p90 * 0.98, where  # planted at 2-300x the p90 (D9.2)
        elif r["label"] == "UNDER_PRICE":
            assert usd <= b.p10 / 2 * 1.02, where  # planted at 1/2-1/30 of the p10
        elif r["label"] == "QTY_VALUE_IMPLAUSIBLE":
            assert usd >= 10 * b.p90, where
            assert float(r["normalised_quantity"]) / float(r["bench_units_per_unit"]) <= 20
        elif r["label"] == "ROUTE_NO_ECONOMIC_SENSE":
            assert r["true_hs6"] in cat.PARITY_HS6
            assert b.p75 * 0.98 <= usd <= b.p90 * 1.02, where
        elif (
            g.role == "hard_negative"
            and r["line_id"] == "L1"
            and g.hard_kind != ("unusual_route_explained")
        ):
            assert b.p10 <= usd <= b.p90, where
        else:  # clean price, incl. PLACEHOLDER_DESC and ARITHMETIC_ERROR lines
            assert b.p25 * 0.98 <= usd <= b.p75 * 1.02, where


def test_placeholder_lines_have_null_expected_hs6(items, labels):
    lines = {(r["invoice_id"], r["line_id"]): r for r in _rows(lines_csv(items))}
    by_id = {g.invoice.invoice_id: g.invoice for g in items}
    rows = [r for r in labels if r["label"] == "PLACEHOLDER_DESC"]
    for r in rows:
        assert lines[(r["invoice_id"], r["line_id"])]["hs6"] == ""
        li = next(x for x in by_id[r["invoice_id"]].line_items if x.line_id == r["line_id"])
        assert li.description in cat.PLACEHOLDER_DESCRIPTIONS
    non_placeholder = [x for x in lines.values() if x["label"] != "PLACEHOLDER_DESC"]
    assert all(x["hs6"] == x["true_hs6"] for x in non_placeholder)


def test_clean_descriptions_are_specific(items):
    for g in items:
        for li in g.invoice.line_items:
            if li.description not in cat.PLACEHOLDER_DESCRIPTIONS:
                assert len(li.description.split()) >= 3, li.description


def test_residential_consignee_only_where_planted(items, labels):
    planted = {r["invoice_id"] for r in labels if r["label"] == "RESIDENTIAL_CONSIGNEE"}
    for g in items:
        inv = g.invoice
        parties = [inv.seller, inv.buyer] + ([inv.consignee] if inv.consignee else [])
        residential = any(p.address_type == "residential" for p in parties)
        assert residential == (inv.invoice_id in planted), inv.invoice_id
        if residential:
            total_usd = inv.stated_total / g.fx_rate
            assert total_usd >= 30_000


def test_origin_consistent_unless_geo_planted(items, labels):
    planted = {r["invoice_id"] for r in labels if r["label"] == "GEO_INCONSISTENT"}
    names = {cc: set(v) for cc, v in cat.COUNTRY_NAMES.items()}
    for g in items:
        inv = g.invoice
        if inv.invoice_id in planted:
            continue
        origin = inv.country_of_origin or ""
        explained = "re-export" in origin or "transhipped" in origin
        assert explained or origin in names[inv.seller.country], (inv.invoice_id, origin)


def test_pdfs_exist_and_text_is_selectable(items):
    pdfs = sorted(PDF_DIR.glob("*.pdf"))
    assert len(pdfs) == N
    for g in items:
        path = PDF_DIR / g.invoice.source_file
        with pdfplumber.open(path) as pdf:
            text = pdf.pages[0].extract_text() or ""
        assert g.invoice.invoice_id in text
        assert "SYNTHETIC TEST DOCUMENT" in text
        total = f"{g.invoice.stated_total:,.2f}"
        assert total in text, (path.name, total)


def test_all_commodities_routes_and_templates_used(items):
    hs6 = {ln.hs6 for g in items for ln in g.lines}
    assert hs6 == set(cat.COMMODITIES)
    assert {f"{g.invoice.seller.country}-{g.invoice.buyer.country}" for g in items} == set(
        cat.ROUTES
    )
    assert {g.template for g in items} == {"classic", "modern", "trade"}


@pytest.mark.parametrize("n", [20, 100])
def test_other_sizes_generate_valid_sets(n):
    out = generate(7, n)
    assert len(out) == n
    counts = Counter(a[0] for g in out for a in g.anomalies)
    assert set(counts) == set(ANOMALY_TYPES)
    assert math.isclose(sum(g.role == "anomalous" for g in out), round(0.3 * n))
