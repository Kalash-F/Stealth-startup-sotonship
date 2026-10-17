from rules_helpers import make_band, make_enriched, make_invoice

from tbml.rules import route_no_economic_sense as r5
from tbml.rules._common import config
from tbml.schemas import Rule, Severity

PARITY = config("route_no_economic_sense")["parity_hs6"][0]
COPPER = make_band(hs6=PARITY, unit="kg", p10=7.4, p25=8.3, median=9.0, p75=9.6, p90=10.3)


def run(price, hs6=PARITY, band=COPPER, cfg_medians=None):
    inv = make_invoice()
    enriched = make_enriched(hs6=hs6, unit_price_usd=price)
    if cfg_medians is not None:
        cfg = config("route_no_economic_sense")
        old = cfg["country_medians"]
        cfg["country_medians"] = cfg_medians
        try:
            return r5.check(inv, [enriched], [band])
        finally:
            cfg["country_medians"] = old
    return r5.check(inv, [enriched], [band])


def test_parity_good_priced_above_p75_is_flagged():
    (flag,) = run(9.9)
    assert flag.rule == Rule.ROUTE_NO_ECONOMIC_SENSE and flag.severity == Severity.medium
    assert flag.line_id == "L1"
    assert "China" in flag.reason and "United Kingdom" in flag.reason
    assert flag.evidence["p75"] == 9.6


def test_price_at_or_below_p75_not_flagged():
    assert run(9.0) == []
    assert run(COPPER.p75) == []  # exactly on the threshold


def test_non_parity_good_not_flagged_even_if_expensive():
    assert run(5.0, hs6="731815", band=make_band(p75=4.0)) == []


def test_missing_benchmark_or_price_not_flagged():
    inv = make_invoice()
    assert r5.check(inv, [make_enriched(hs6=PARITY, unit_price_usd=9.9)], [None]) == []
    assert r5.check(inv, [make_enriched(hs6=PARITY, unit_price_usd=None)], [COPPER]) == []


def test_country_medians_override_the_parity_list():
    close = {PARITY: {"CN": 9.0, "GB": 9.9}}  # 10% apart, within the 15% tolerance
    far = {PARITY: {"CN": 9.0, "GB": 12.0}}  # 33% apart
    assert len(run(9.9, cfg_medians=close)) == 1
    assert run(9.9, cfg_medians=far) == []
    assert run(9.9, cfg_medians=close)[0].evidence["parity_basis"] == "country_medians"


def test_median_gap_exactly_at_tolerance_counts_as_close():
    tol = config("route_no_economic_sense")["parity_tolerance_pct"]
    edge = {PARITY: {"CN": 10.0, "GB": 10.0 * (1 + tol / 100)}}
    assert len(run(9.9, cfg_medians=edge)) == 1
