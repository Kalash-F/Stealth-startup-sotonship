import pytest
from rules_helpers import make_enriched, make_invoice, make_line

from tbml.rules import placeholder_desc as r3
from tbml.rules._common import config
from tbml.schemas import Rule, Severity


def run(description, hs6="731815", confidence=0.95):
    inv = make_invoice([make_line(description=description)])
    enriched = make_enriched(hs6=hs6, classification_confidence=confidence)
    return r3.check(inv, [enriched], [None])


@pytest.mark.parametrize(
    "text",
    [
        "Product ABC",
        "PRODUCT XYZ",
        "Item 1",
        "ITEM 12",
        "Goods as per contract",
        "Various",
        "Misc goods",
        "Merchandise",
    ],
)
def test_placeholder_wordings_are_flagged(text):
    (flag,) = run(text, hs6=None, confidence=0.0)
    assert flag.rule == Rule.PLACEHOLDER_DESC and flag.line_id == "L1"
    assert flag.severity == Severity.high  # vague AND unclassifiable
    assert text in flag.reason
    assert flag.evidence["classified"] is False


def test_pattern_match_but_classified_is_medium():
    (flag,) = run("Item 7", hs6="731815")
    assert flag.severity == Severity.medium


def test_short_and_unclassified_without_pattern_is_medium():
    (flag,) = run("Widgets", hs6=None, confidence=0.0)
    assert flag.severity == Severity.medium
    assert "word" in flag.reason


def test_specific_description_not_flagged():
    assert run("M6 x 30mm hex bolts, zinc plated") == []
    assert run("Product mix for retail", hs6=None) == []


def test_word_count_edge_exactly_min_words_is_not_short():
    n = config("placeholder_desc")["min_words"]
    assert run(" ".join(["bolts"] * n), hs6=None, confidence=0.0) == []
    assert run(" ".join(["bolts"] * (n - 1)), hs6=None, confidence=0.0) != []


def test_short_but_classified_not_flagged():
    assert run("Bolts", hs6="731815") == []


def test_missing_enrichment_treated_as_unclassified():
    inv = make_invoice([make_line(description="Sundry")])
    (flag,) = r3.check(inv, [], [])
    assert flag.severity == Severity.high
