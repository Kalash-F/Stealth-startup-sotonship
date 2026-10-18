"""Tasks 3.9, 3.10, 3.13: hand-worked normalisation examples. FX is fx.csv (2024, units per USD)."""

import csv

import pytest

from tbml.classify import KeywordProposer, enrich, normalise
from tbml.classify.normalise import benchmark_units, load_unit_weights
from tbml.paths import REFERENCE_DIR, SYNTHETIC_DIR
from tbml.schemas import Invoice, LineItem


def line(description, quantity, unit, unit_price):
    return LineItem(
        line_id="L1",
        description=description,
        quantity=quantity,
        unit=unit,
        unit_price=unit_price,
        line_total=quantity * unit_price,
        extraction_confidence=1.0,
    )


def test_screws_pieces_to_kg_usd():
    # 100,000 pcs M6 bolts x 0.009 kg = 900 kg; USD invoice, so 5.00/pc -> 5.00 / 0.009 = 555.555556
    n = normalise(line("M6 x 30mm hex bolts, zinc plated", 100_000, "pcs", 5.0), "731815", "USD")
    assert n.unit == "kg" and n.quantity == pytest.approx(900)
    assert n.unit_price_usd == pytest.approx(555.555556)


def test_screws_carton_of_1000_gbp():
    # 100 cartons x 1,000 pc x 0.009 kg = 900 kg; GBP 7.00/carton / 0.7824 = USD 8.9468/carton;
    # per kg: 8.9445 / 9 kg per carton = 0.993834
    n = normalise(
        line("Hex head bolts M6, carton of 1,000 pcs", 100, "cartons", 7.0), "731815", "GBP"
    )
    assert n.quantity == pytest.approx(900)
    assert n.unit_price_usd == pytest.approx(7.0 / 0.7824 / 9.0, rel=1e-6)


def test_soft_drink_cartons_to_litres_aed():
    # 1,000 cartons of 24 x 330 ml = 7.92 l each -> 7,920 l; AED 20/carton / 3.6725 = 5.4459 USD
    # per carton; / 7.92 l = 0.687615 USD/l
    n = normalise(
        line("Lemon soft drink 330ml cans, carton of 24", 1000, "cartons", 20.0), "220210", "AED"
    )
    assert n.unit == "l" and n.quantity == pytest.approx(7920)
    assert n.unit_price_usd == pytest.approx(20 / 3.6725 / 7.92, rel=1e-6)


def test_usb_carton_of_100_eur():
    # 50 cartons x 100 = 5,000 u; EUR 450/carton / 0.9242 = 486.91 USD; / 100 = 4.8691 USD/u
    n = normalise(
        line("USB 2.0 memory stick 32GB, carton of 100", 50, "cartons", 450.0), "852351", "EUR"
    )
    assert n.unit == "u" and n.quantity == pytest.approx(5000)
    assert n.unit_price_usd == pytest.approx(450 / 0.9242 / 100, rel=1e-6)


def test_tshirts_per_dozen_cny():
    # 500 dozen x 12 = 6,000 u; CNY 36/dozen / 7.1957 = 5.0030 USD; / 12 = 0.416916 USD/u
    n = normalise(
        line("Plain white cotton T-shirts, packed per dozen", 500, "dozen", 36.0), "610910", "CNY"
    )
    assert n.quantity == pytest.approx(6000)
    assert n.unit_price_usd == pytest.approx(36 / 7.1957 / 12, rel=1e-6)


def test_coffee_bags_with_stated_weight():
    # 200 bags x 60 kg = 12,000 kg; USD 210/bag / 60 = 3.50 USD/kg
    n = normalise(
        line("Robusta green coffee beans, 60kg jute bags", 200, "bags", 210.0), "090111", "USD"
    )
    assert n.quantity == pytest.approx(12_000) and n.unit_price_usd == pytest.approx(3.5)


def test_coffee_bags_without_weight_use_table_default():
    n = normalise(line("Green coffee beans in bags", 10, "bags", 300.0), "090111", "USD")
    assert n.quantity == pytest.approx(600) and n.unit_price_usd == pytest.approx(5.0)


def test_copper_tonnes_gbp():
    # 50 MT x 1,000 = 50,000 kg; GBP 7,000/MT / 0.7824 = 8,946.8 USD/MT; / 1000 = 8.9468 USD/kg
    n = normalise(line("Copper cathodes Grade A, 99.99% Cu", 50, "MT", 7000.0), "740311", "GBP")
    assert n.quantity == pytest.approx(50_000)
    assert n.unit_price_usd == pytest.approx(7000 / 0.7824 / 1000, rel=1e-6)


def test_laptops_units_usd():
    # benchmark unit is u already: quantity unchanged, price unchanged
    n = normalise(
        line("14-inch laptop computer, Intel Core i5", 300, "units", 489.0), "847130", "USD"
    )
    assert (n.quantity, n.unit, n.unit_price_usd) == (300, "u", 489.0)


@pytest.mark.parametrize(
    ("item", "hs6", "currency", "why"),
    [
        (line("M7 hex bolts", 10, "pcs", 1.0), "731815", "USD", "unit_weights.csv"),
        (line("Hex bolts", 10, "cartons", 1.0), "731815", "USD", "no pack size"),
        (line("Soft drink", 10, "cans", 1.0), "220210", "USD", "volume"),
        (line("Copper cathodes", 10, "boxes of 4", 1.0), "740311", "USD", "unrecognised"),
        (line("USB flash drive", 10, "litres", 1.0), "852351", "USD", "cannot be converted"),
        (line("USB flash drive", 10, "pcs", 1.0), "852351", "XYZ", "no FX rate"),
    ],
)
def test_impossible_conversion_is_null_with_explanation(item, hs6, currency, why):
    n = normalise(item, hs6, currency)
    assert n.unit_price_usd is None and n.quantity is None
    assert why in n.note


def test_unclassified_line_is_not_normalised():
    n = normalise(line("Product ABC", 10, "pcs", 1.0), None, "USD")
    assert n.unit_price_usd is None and "no HS6" in n.note


def test_unit_weights_rows_are_documented():
    rows = load_unit_weights()
    assert rows and all(r["basis"].strip() and float(r["kg_per_unit"]) > 0 for r in rows)


def test_every_target_hs6_has_a_benchmark_unit():
    for hs6 in ["731815", "220210", "852351", "610910", "090111", "740311", "847130"]:
        assert benchmark_units(hs6), hs6


def test_matches_generator_truth_on_every_line():
    with open(SYNTHETIC_DIR / "lines.csv", newline="") as f:
        truth = {(r["invoice_id"], r["line_id"]): r for r in csv.DictReader(f)}
    checked = 0
    for path in sorted((SYNTHETIC_DIR / "truth").glob("*.json")):
        inv = Invoice.model_validate_json(path.read_text())
        for item, e in zip(inv.line_items, enrich(inv, KeywordProposer()), strict=True):
            t = truth[(inv.invoice_id, item.line_id)]
            if not t["hs6"]:
                assert e.unit_price_usd is None and e.normalised_quantity is None
                continue
            assert e.benchmark_unit == t["benchmark_unit"]
            assert e.normalised_quantity == pytest.approx(float(t["normalised_quantity"]), rel=1e-3)
            assert e.unit_price_usd == pytest.approx(float(t["unit_price_usd"]), rel=1e-3)
            assert e.normalisation_note
            checked += 1
    assert checked > 100


def test_fx_table_is_single_schema():
    with open(REFERENCE_DIR / "fx.csv", newline="") as f:
        rows = list(csv.DictReader(f))
    assert rows and all(r["units_per_usd"] for r in rows)
