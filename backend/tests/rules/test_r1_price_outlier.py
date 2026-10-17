import math

import pytest
from rules_helpers import make_band, make_enriched, make_invoice

from tbml.rules import price_outlier
from tbml.schemas import Rule, Severity

BAND = make_band()


def run(price, band=BAND, warnings=None, **enriched_fields):
    inv = make_invoice()
    return price_outlier.check(
        inv, [make_enriched(unit_price_usd=price, **enriched_fields)], [band], warnings
    )


def test_over_invoiced_far_outside_band_is_high():
    (flag,) = run(5555.56)
    assert flag.rule == Rule.PRICE_OUTLIER and flag.severity == Severity.high
    assert flag.line_id == "L1"
    assert flag.reason.startswith("Over-invoiced")
    assert flag.evidence["median"] == BAND.median and flag.evidence["unit_price_usd"] == 5555.56
    assert flag.variance_pct == pytest.approx((5555.56 / BAND.median - 1) * 100, abs=0.1)
    assert flag.evidence["benchmark_is_mock"] is True


def test_under_invoiced_says_so():
    (flag,) = run(0.02)
    assert flag.reason.startswith("Under-invoiced") and flag.severity == Severity.high
    assert "lower" in flag.reason


def test_just_outside_band_is_medium():
    (flag,) = run(BAND.p90 * 1.01)
    assert flag.severity == Severity.medium
    (flag,) = run(BAND.p10 * 0.99)
    assert flag.severity == Severity.medium and flag.reason.startswith("Under-invoiced")


def test_inside_band_no_flag():
    assert run(BAND.median) == []
    assert run(BAND.p25) == []


@pytest.mark.parametrize("edge", ["p10", "p90"])
def test_exactly_on_band_edge_is_not_flagged(edge):
    assert run(getattr(BAND, edge)) == []


def test_high_starts_beyond_one_band_width_from_median():
    spread = math.log(BAND.p90 / BAND.p10)
    just_inside = BAND.median * math.exp(spread * 0.99)
    just_beyond = BAND.median * math.exp(spread * 1.01)
    assert run(just_inside)[0].severity == Severity.medium
    assert run(just_beyond)[0].severity == Severity.high


def test_no_benchmark_skips_with_warning():
    warnings: list[str] = []
    assert run(5555.56, band=None, warnings=warnings) == []
    assert len(warnings) == 1 and "L1" in warnings[0]


def test_null_price_skips_with_warning():
    warnings: list[str] = []
    assert run(None, warnings=warnings) == []
    assert len(warnings) == 1
