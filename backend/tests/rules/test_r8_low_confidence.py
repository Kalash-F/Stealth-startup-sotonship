from rules_helpers import make_enriched, make_invoice, make_line

from tbml.rules import low_confidence as r8
from tbml.rules._common import config
from tbml.schemas import Rule, Severity

FLOOR = config("low_confidence")["min_confidence"]


def run(extraction=0.97, classification=0.95):
    inv = make_invoice([make_line(extraction_confidence=extraction)])
    return r8.check(inv, [make_enriched(classification_confidence=classification)], [None])


def test_low_extraction_confidence_flagged_low_severity():
    (flag,) = run(extraction=0.3)
    assert flag.rule == Rule.LOW_CONFIDENCE and flag.severity == Severity.low
    assert flag.line_id == "L1" and "check this line manually" in flag.reason
    assert "30%" in flag.reason


def test_low_classification_confidence_flagged():
    (flag,) = run(classification=0.1)
    assert "identifying the product" in flag.reason


def test_both_low_gives_one_flag():
    (flag,) = run(extraction=0.2, classification=0.2)
    assert "and" in flag.reason


def test_confident_line_not_flagged():
    assert run() == []


def test_exactly_at_floor_is_flagged():
    # extraction caps unverified numbers at exactly 0.5, so the floor itself must count as weak
    assert len(run(extraction=FLOOR)) == 1
    assert run(extraction=FLOOR + 0.01, classification=FLOOR + 0.01) == []


def test_missing_enrichment_still_checks_extraction():
    inv = make_invoice([make_line(extraction_confidence=0.1)])
    assert len(r8.check(inv, [], [])) == 1
    inv = make_invoice()
    assert r8.check(inv, [], []) == []
