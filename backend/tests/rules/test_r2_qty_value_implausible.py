from rules_helpers import make_band, make_enriched, make_invoice, make_line

from tbml.rules import qty_value_implausible as r2
from tbml.rules._common import config
from tbml.schemas import Rule, Severity

BAND = make_band()
MULT = config("qty_value_implausible")["ceiling_p90_multiple"]


def run(price, qty=1000.0, band=BAND, lines=None):
    inv = make_invoice(lines)
    return r2.check(inv, [make_enriched(unit_price_usd=price, normalised_quantity=qty)], [band])


def test_value_far_above_ceiling_is_flagged_high():
    (flag,) = run(BAND.p90 * MULT * 20)
    assert flag.rule == Rule.QTY_VALUE_IMPLAUSIBLE and flag.line_id == "L1"
    assert flag.severity == Severity.high
    assert flag.evidence["line_value_usd"] > flag.evidence["ceiling_usd"]
    assert "out of proportion" in flag.reason


def test_value_modestly_above_ceiling_is_medium():
    (flag,) = run(BAND.p90 * MULT * 1.5)
    assert flag.severity == Severity.medium


def test_normal_value_no_flag():
    assert run(BAND.median) == []
    assert run(BAND.p90) == []


def test_exactly_at_ceiling_is_not_flagged():
    assert run(BAND.p90 * MULT) == []
    assert run(BAND.p90 * MULT * 1.0001) != []


def test_missing_benchmark_or_quantity_no_flag():
    assert run(1e3, band=None) == []
    inv = make_invoice()
    assert r2.check(inv, [make_enriched(normalised_quantity=None)], [BAND]) == []
    assert r2.check(inv, [make_enriched(unit_price_usd=None)], [BAND]) == []


def test_invoice_total_disproportionate_to_item_count():
    limit = config("qty_value_implausible")["max_avg_line_value_usd"]
    # Within the per-line ceiling (p90 band) but one line carries a huge total.
    price = BAND.p90
    qty = limit * 2 / price
    flags = run(price, qty=qty, band=make_band(p90=BAND.p90, p75=BAND.p75))
    assert [f.line_id for f in flags] == [None]
    assert flags[0].severity == Severity.medium
    assert flags[0].evidence["line_count"] == 1


def test_invoice_total_exactly_at_limit_not_flagged():
    limit = config("qty_value_implausible")["max_avg_line_value_usd"]
    price = BAND.p90
    assert run(price, qty=limit / price) == []


def test_invoice_level_not_added_when_a_line_already_flagged():
    flags = run(BAND.p90 * MULT * 20, qty=1e9, lines=[make_line()])
    assert [f.line_id for f in flags] == ["L1"]
