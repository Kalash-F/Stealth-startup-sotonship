import pytest
from rules_helpers import make_band, make_enriched, make_invoice, make_line

from tbml.rules import run_rules, run_rules_with_warnings
from tbml.rules._common import config
from tbml.schemas import Flag, PriorityBand, Rule, Severity
from tbml.score import score

W = config("scoring")["weights"]


def flag(severity, n=0):
    return Flag(
        flag_id=f"X{n}",
        rule=Rule.PRICE_OUTLIER,
        line_id=None,
        severity=severity,
        expected=None,
        stated=None,
        variance_pct=None,
        reason="x",
        evidence={},
    )


def test_no_flags_is_low_zero():
    assert score([]) == (0.0, PriorityBand.low)


def test_weights_sum():
    pts, _ = score([flag(Severity.medium), flag(Severity.low)])
    assert pts == W["medium"] + W["low"]


@pytest.mark.parametrize(
    "flags,band",
    [
        ([flag(Severity.high)], PriorityBand.review),  # 40
        (
            [flag(Severity.high), flag(Severity.medium), flag(Severity.medium)],
            PriorityBand.review_now,
        ),  # 70
        ([flag(Severity.medium)], PriorityBand.low),  # 15
        (
            [flag(Severity.medium), flag(Severity.low), flag(Severity.low)],
            PriorityBand.review,
        ),  # 25
        ([flag(Severity.medium), flag(Severity.low)], PriorityBand.low),  # 20
    ],
)
def test_bands(flags, band):
    assert score(flags)[1] == band


def test_band_edges_follow_config():
    cfg = config("scoring")
    assert cfg["review_now_min"] == 60 and cfg["review_min"] == 25  # plan 4.4


def test_score_is_capped_at_100():
    pts, band = score([flag(Severity.high, i) for i in range(5)])
    assert pts == 100.0 and band == PriorityBand.review_now


def test_run_rules_sorts_highest_severity_first():
    band = make_band()
    lines = [
        make_line("L1", unit_price=4.0, line_total=4000.0),
        make_line("L2", quantity=100, unit_price=10, line_total=1500),
    ]
    enriched = [
        make_enriched("L1", unit_price_usd=9.0),
        make_enriched("L2", unit_price_usd=5555.0, classification_confidence=0.2),
    ]
    inv = make_invoice(lines)
    flags = run_rules(inv, enriched, [band, band])
    severities = [f.severity for f in flags]
    rank = {Severity.high: 0, Severity.medium: 1, Severity.low: 2}
    assert severities == sorted(severities, key=rank.get)
    assert {f.rule for f in flags} >= {
        Rule.PRICE_OUTLIER,
        Rule.ARITHMETIC_ERROR,
        Rule.LOW_CONFIDENCE,
    }
    assert len({f.flag_id for f in flags}) == len(flags)


def test_run_rules_collects_warnings():
    inv = make_invoice()
    flags, warnings = run_rules_with_warnings(inv, [make_enriched()], [None])
    assert flags == [] and len(warnings) == 1


def test_every_flag_has_reason_and_evidence():
    band = make_band()
    inv = make_invoice([make_line(quantity=100, unit_price=10, line_total=1500)])
    for f in run_rules(inv, [make_enriched(unit_price_usd=5555.0)], [band]):
        assert f.reason.strip() and f.evidence
