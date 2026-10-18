"""R1 on database bands: percentile tiers, agreement across years, other basis, origin, score."""

import pytest
from rules_helpers import make_band, make_enriched, make_invoice, make_line

from tbml.rules import price_outlier
from tbml.schemas import Benchmark, PriceBand, Rule, Severity
from tbml.score import score

# per kg: p1 1, p5 2, p10 3, p25 4, median 5, p75 6, p90 8, p95 10, p99 20
PCT = dict(p1=1.0, p5=2.0, p10=3.0, p25=4.0, median=5.0, p75=6.0, p90=8.0, p95=10.0, p99=20.0)


def period(name: str, scale: float = 1.0, n: int = 1000, **fields) -> PriceBand:
    data = dict(
        level="hs6",
        code="731815",
        basis="per_kg",
        unit="kg",
        period=name,
        origin="ALL",
        recommended=name == "2025",
        n_observations=n,
        months=12,
        median_vs_prev_year=None,
        **{k: v * scale for k, v in PCT.items()},
    )
    return PriceBand(**{**data, **fields})


def db_band(history=None, **fields) -> Benchmark:
    if history is None:
        history = [period(p) for p in ("2023", "2024", "2025", "2026", "all")]
    tails = {k: PCT[k] for k in ("p1", "p5", "p95", "p99")}
    base = dict(
        **{k: PCT[k] for k in ("p10", "p25", "median", "p75", "p90")},
        **tails,
        is_mock=False,
        sources=["HMRC OTS UK imports (benchmark database)"],
        level="hs6",
        code="731815",
        basis="per_kg",
        period="2025",
        history=history,
    )
    return make_band(**{**base, **fields})


def run(price, band=None, invoice=None):
    inv = invoice or make_invoice()
    return price_outlier.check(inv, [make_enriched(unit_price_usd=price)], [band or db_band()])


@pytest.mark.parametrize("price", [2.0, 5.0, 10.0])
def test_p5_to_p95_is_normal(price):
    assert run(price) == []


@pytest.mark.parametrize(
    ("price", "severity", "position"),
    [
        (15.0, Severity.medium, "high"),
        (1.5, Severity.medium, "low"),
        (25.0, Severity.high, "extreme_high"),
        (0.5, Severity.high, "extreme_low"),
    ],
)
def test_tiers(price, severity, position):
    (flag,) = run(price)
    assert flag.rule == Rule.PRICE_OUTLIER and flag.severity == severity
    assert flag.evidence["position"] == position
    assert flag.reason.startswith("Over-invoiced" if price > 5 else "Under-invoiced")
    assert flag.evidence["agreement"] == 1.0 and flag.evidence["score_factor"] == 1.5
    assert "5 of 5 periods" in flag.reason
    assert flag.expected.startswith("$2.00 to $10.00 per kg")


def test_price_normal_in_most_years_is_lowered():
    # Prices doubled in 2025-2026: $15 is above p95 now but normal in 2023, 2024 and pooled.
    hist = [period("2023", 2), period("2024", 2), period("2025"), period("2026"), period("all", 2)]
    (flag,) = run(15.0, db_band(hist))
    assert flag.severity == Severity.low
    assert flag.evidence["agreement"] == 0.4 and flag.evidence["score_factor"] == pytest.approx(0.9)
    assert "Severity lowered" in flag.reason and "2023, 2024 and all years pooled" in flag.reason


def test_extreme_in_most_years_raises_a_review_price():
    # $15 is in the 95-99 tail of 2025, but beyond p99 in every other period.
    hist = [period(p, 0.5) for p in ("2023", "2024")] + [period("2025")]
    hist += [period(p, 0.5) for p in ("2026", "all")]
    (flag,) = run(15.0, db_band(hist))
    assert flag.severity == Severity.high and "Severity raised" in flag.reason
    assert flag.evidence["periods_extreme"] == ["2023", "2024", "2026", "all"]


def test_thin_years_are_left_out():
    hist = [period("2023", 2, n=10), period("2025"), period("all")]
    (flag,) = run(15.0, db_band(hist))
    assert [p["period"] for p in flag.evidence["periods"]] == ["2025", "all"]


def test_review_price_normal_for_its_origin_is_lowered():
    origin = period("2025", 2, origin="CN")  # CN normal range 4 to 20
    (flag,) = run(15.0, db_band(origin_band=origin))
    assert flag.severity == Severity.low
    assert flag.evidence["origin_context"]["position"] == "normal"
    assert "imports from China" in flag.reason and "whole route" in flag.reason


def test_origin_never_lowers_an_extreme_price():
    origin = period("2025", 10, origin="CN")
    (flag,) = run(25.0, db_band(origin_band=origin))
    assert flag.severity == Severity.high
    assert "imports from China" in flag.reason and "Severity lowered" not in flag.reason


def test_drift_is_reported():
    hist = [period("2024"), period("2025", median_vs_prev_year=1.4), period("all")]
    (flag,) = run(25.0, db_band(hist))
    assert "rose 40% in 2025" in flag.reason


def _per_item_band() -> PriceBand:
    # screws per item: normal range $0.02 to $0.10
    return PriceBand(
        level="hs6", code="731815", basis="per_unit", unit="u", period="2025", origin="ALL",
        recommended=True, n_observations=500, months=12, median_vs_prev_year=None,
        p1=0.01, p5=0.02, p10=0.03, p25=0.04, median=0.05, p75=0.06, p90=0.08, p95=0.1, p99=0.2,
    )  # fmt: skip


def counted_screws(unit_price: float):
    # counted screws convert straight to the per-item band above
    item = make_line(
        description="M6 hex bolts",
        quantity=1000.0,
        unit="pcs",
        unit_price=unit_price,
        line_total=unit_price * 1000,
    )
    return make_invoice([item], currency="USD")


def test_both_bases_extreme_is_the_strongest_signal():
    inv = counted_screws(1.0)  # $1 per screw = $125/kg: extreme both ways
    (flag,) = run(125.0, db_band(other_basis=_per_item_band()), inv)
    assert flag.severity == Severity.high and flag.evidence["score_factor"] == 1.5
    assert flag.evidence["other_basis"]["position"] == "extreme_high"
    assert "strongest sign" in flag.reason


def test_other_basis_normal_lowers_the_flag():
    inv = counted_screws(0.05)  # normal per item, but call it $25/kg (a weight slip)
    (flag,) = run(25.0, db_band(other_basis=_per_item_band()), inv)
    assert flag.severity == Severity.medium and flag.evidence["score_factor"] == 0.5
    assert "check the quantity and unit" in flag.reason


def test_score_uses_the_flag_factor():
    (strong,) = run(25.0)
    hist = [period("2023", 2), period("2024", 2), period("2025"), period("2026"), period("all", 2)]
    (weak,) = run(15.0, db_band(hist))
    assert score([strong])[0] == 60.0  # high 40 x 1.5
    assert score([weak])[0] == pytest.approx(4.5)  # low 5 x 0.9


def test_bands_without_tails_keep_the_p10_p90_rule():
    (flag,) = run(9.0, make_band())  # fixture band: p90 8.5
    assert flag.severity == Severity.medium and "score_factor" not in flag.evidence
