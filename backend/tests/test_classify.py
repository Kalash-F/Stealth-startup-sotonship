"""Tasks 3.7, 3.8, 3.11: classification against synthetic truth and the validation rules."""

import csv
from types import SimpleNamespace

import pytest

from tbml.classify import (
    AnthropicProposer,
    CachedProposer,
    KeywordProposer,
    ProposerError,
    classify_description,
    default_proposer,
    enrich,
)
from tbml.classify.hs6 import default_hs6
from tbml.classify.placeholder import is_placeholder
from tbml.paths import SYNTHETIC_DIR
from tbml.schemas import HS6Candidate, Invoice
from tbml.synthetic.catalogue import COMMODITIES, PLACEHOLDER_DESCRIPTIONS

HS6_TARGETS = ["731815", "220210", "852351", "610910", "090111", "740311", "847130"]


class FakeProposer:
    def __init__(self, candidates):
        self.candidates, self.calls = candidates, 0

    def propose(self, description):
        self.calls += 1
        return [HS6Candidate(hs6=h, score=s) for h, s in self.candidates]


def _invoices():
    return [
        Invoice.model_validate_json(p.read_text())
        for p in sorted((SYNTHETIC_DIR / "truth").glob("*.json"))
    ]


def _truth():
    with open(SYNTHETIC_DIR / "lines.csv", newline="") as f:
        return {(r["invoice_id"], r["line_id"]): r for r in csv.DictReader(f)}


def test_hs6_reference_covers_targets_and_is_well_formed():
    entries = default_hs6()
    assert set(HS6_TARGETS) <= set(entries)
    assert all(len(code) == 6 and code.isdigit() for code in entries)
    assert all(e.description for e in entries.values())


def test_accuracy_on_synthetic_lines_and_placeholders_are_null():
    truth = _truth()
    proposer = KeywordProposer()
    real_ok = real_n = placeholder_n = 0
    for inv in _invoices():
        for item, line in zip(inv.line_items, enrich(inv, proposer), strict=True):
            expected = truth[(inv.invoice_id, item.line_id)]["hs6"] or None
            if expected is None:
                placeholder_n += 1
                assert line.hs6 is None, item.description
                assert line.classification_confidence < 0.2
            else:
                real_n += 1
                real_ok += line.hs6 == expected
    assert placeholder_n >= 4
    assert real_ok / real_n >= 0.9
    assert real_ok == real_n  # the baseline is currently perfect on this set; keep it that way


@pytest.mark.parametrize("description", PLACEHOLDER_DESCRIPTIONS)
def test_catalogue_placeholders_never_reach_the_proposer(description):
    proposer = FakeProposer([("731815", 0.99)])
    result = classify_description(description, proposer)
    assert result.hs6 is None and result.confidence < 0.2 and result.reason
    assert proposer.calls == 0


@pytest.mark.parametrize(
    "description", ["Product ABC", "ITEM 1", "Goods as per contract", "n/a", "", "123", "Various"]
)
def test_is_placeholder_true(description):
    assert is_placeholder(description)


@pytest.mark.parametrize(
    "description",
    ["Bolts as per contract", "USB flash drive", "M6 hex bolts", "Green coffee", "Item: laptop"],
)
def test_is_placeholder_false(description):
    assert not is_placeholder(description)


def test_only_codes_in_hs6_list_survive():
    proposer = FakeProposer([("999999", 0.95), ("731815", 0.7), ("731815", 0.6)])
    result = classify_description("steel hex bolts", proposer)
    assert result.hs6 == "731815"
    assert [c.hs6 for c in result.candidates] == ["731815"]  # invalid dropped, duplicate removed
    assert result.hs6_description if hasattr(result, "hs6_description") else result.description


def test_nothing_valid_gives_null_with_reason():
    result = classify_description("steel hex bolts", FakeProposer([("999999", 0.95)]))
    assert result.hs6 is None and "HS6 list" in result.reason


def test_low_top_score_gives_null_but_keeps_candidates():
    result = classify_description("steel hex bolts", FakeProposer([("731815", 0.49)]))
    assert result.hs6 is None
    assert [c.hs6 for c in result.candidates] == ["731815"]
    assert "below 0.5" in result.reason


def test_score_exactly_at_threshold_is_accepted():
    assert classify_description("hex bolts", FakeProposer([("731815", 0.5)])).hs6 == "731815"


def test_candidates_sorted_and_capped_at_three():
    proposer = FakeProposer([("731814", 0.1), ("731815", 0.9), ("731816", 0.3), ("731823", 0.2)])
    result = classify_description("hex bolts", proposer)
    assert [c.hs6 for c in result.candidates] == ["731815", "731816", "731823"]


def test_proposer_error_gives_null():
    class Broken:
        def propose(self, description):
            raise ProposerError("boom")

    result = classify_description("hex bolts", Broken())
    assert result.hs6 is None and "boom" in result.reason


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Self-tapping screws, zinc plated", "731814"),
        ("Wood screws 4x40", "731812"),
        ("Hex nuts M8", "731816"),
        ("Polyester T-shirts, knitted", "610990"),
        ("Roasted Arabica coffee beans", "090121"),
        ("Decaffeinated green coffee, unroasted", "090112"),
        ("Copper wire-bars", "740312"),
        ("Premium USB flash drive with logo", "852351"),
    ],
)
def test_sibling_codes_are_told_apart(description, expected):
    assert classify_description(description, KeywordProposer()).hs6 == expected


@pytest.mark.parametrize("description", ["Office chairs, oak", "Packing materials", "Steel pipes"])
def test_unrelated_goods_are_null(description):
    assert classify_description(description, KeywordProposer()).hs6 is None


def test_every_catalogue_variant_classifies_to_its_commodity():
    for commodity in COMMODITIES.values():
        for variant in commodity.variants:
            got = classify_description(variant.description, KeywordProposer()).hs6
            assert got == commodity.hs6, variant.description


def test_cache_makes_second_run_free_and_deterministic(tmp_path):
    inner = FakeProposer([("731815", 0.9)])
    cached = CachedProposer(inner, cache_dir=tmp_path, model="m")
    first = cached.propose("Hex  bolts")
    second = cached.propose("hex bolts")  # case and whitespace normalised
    assert inner.calls == 1 and first == second
    other = CachedProposer(FakeProposer([]), cache_dir=tmp_path, model="m")
    assert other.propose("hex bolts") == first  # survives a new process


class _Client:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), 0
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls += 1
        assert kwargs["temperature"] == 0 and kwargs["model"] == "test-model"
        return SimpleNamespace(content=[SimpleNamespace(text=self.replies.pop(0))])


def test_anthropic_proposer_parses_json_and_retries_once():
    good = 'Sure: {"candidates": [{"hs6": "731815", "score": 0.93}]}'
    client = _Client(["not json", good])
    out = AnthropicProposer("test-model", client).propose("hex bolts")
    assert out == [HS6Candidate(hs6="731815", score=0.93)] and client.calls == 2


def test_anthropic_proposer_fails_after_two_bad_replies():
    client = _Client(["nope", '{"candidates": [{"hs6": "12", "score": 2}]}'])
    with pytest.raises(ProposerError):
        AnthropicProposer("test-model", client).propose("hex bolts")


def test_default_proposer_is_offline_without_key(monkeypatch):
    assert isinstance(default_proposer(), KeywordProposer)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "x")
    assert isinstance(default_proposer(), KeywordProposer)  # key alone is not enough: no model


def test_flat_llm_parse_accepts_dotted_and_numeric_codes():
    from tbml.classify.proposers import _parse

    got = _parse('{"candidates": [{"hs6": "8471.30", "score": 0.9}, {"hs6": 90111, "score": 0.1}]}')
    assert [c.hs6 for c in got] == ["847130", "090111"]


def test_flat_llm_parse_skips_four_digit_codes():
    from tbml.classify.proposers import _parse

    got = _parse('{"candidates": [{"hs6": "7318", "score": 0.9}, {"hs6": "731815", "score": 0.8}]}')
    assert [c.hs6 for c in got] == ["731815"]
    with pytest.raises(ValueError):
        _parse('{"candidates": [{"hs6": "7318", "score": 0.9}]}')
