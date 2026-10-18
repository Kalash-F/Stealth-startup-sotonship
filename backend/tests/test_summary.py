"""Report notes (tbml/summary.py): one LLM call after the rules, split into the summary and the
per-flag notes; offline template, cache, failure fallback."""

import json

import pytest

from tbml import llm
from tbml.fixtures import load_fixture
from tbml.schemas import PriorityBand, Report
from tbml.summary import parse_reply, system_prompt, with_flag_notes, write_notes


class FakeClient:
    model = "fake/model"

    def __init__(self, reply=None, error=None):
        self.reply, self.error, self.calls = reply, error, []

    def complete(self, system, messages, max_tokens=8192, temperature=0, model=None):
        self.calls.append((system, messages, max_tokens))
        if self.error:
            raise self.error
        return self.reply


@pytest.fixture(autouse=True)
def _cache(tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path))
    monkeypatch.delenv("TBML_FLAG_SUMMARIES", raising=False)


def _report() -> Report:
    return Report.model_validate(load_fixture("report"))


def _notes(client=None, report=None, **kw):
    r = report or _report()
    return write_notes(
        r.invoice, r.priority_score, r.priority_band, r.flags, r.lines, r.warnings, client, **kw
    )


def test_template_when_offline():
    notes = _notes()
    assert notes.warning is None and notes.flag_notes == {}
    assert "price outlier" in notes.summary and "L1" in notes.summary
    # the UI shows the score and band beside the summary, so the summary never repeats them
    assert "80" not in notes.summary and "Review now" not in notes.summary


def test_template_clean_invoice():
    notes = write_notes(None, 0, PriorityBand.low, [], [], [])
    assert (notes.summary, notes.warning) == ("No red flags raised.", None)


def test_template_mentions_warnings():
    notes = write_notes(None, 0, PriorityBand.low, [], [], ["line L2 could not be classified"])
    assert notes.summary.endswith("1 check could not run fully.")


def test_one_call_returns_summary_only_by_default():
    client = FakeClient(json.dumps({"summary": "  Line L1 is\n badly overpriced.  "}))
    notes = _notes(client)
    assert (notes.summary, notes.flag_notes, notes.warning) == (
        "Line L1 is badly overpriced.",
        {},
        None,
    )
    assert len(client.calls) == 1
    system, messages, max_tokens = client.calls[0]
    assert '"flags"' not in system  # flag notes are not asked for when they are off
    facts = json.loads(messages[0]["content"])
    assert facts["priority_score"] == 80 and facts["priority_band"] == "Review now"
    assert facts["flags"][0]["rule"] == "PRICE_OUTLIER" and facts["flags"][0]["id"] == "F1"
    assert "evidence" not in facts["flags"][0]  # prompt stays small
    assert max_tokens <= 200


def test_flag_notes_come_from_the_same_call(monkeypatch):
    monkeypatch.setenv("TBML_FLAG_SUMMARIES", "1")
    reply = {
        "summary": "Line L1 is far above the usual price.",
        "flags": {"F1": "Over-invoicing moves money — ask why.", "F2": "Ask.", "X": "?"},
    }
    client = FakeClient("```json\n" + json.dumps(reply) + "\n```")
    report = _report()
    notes = _notes(client, report)
    assert len(client.calls) == 1  # summary and every flag note in one call
    assert '"flags"' in client.calls[0][0]
    assert notes.summary == "Line L1 is far above the usual price."
    assert notes.flag_notes == {"F1": "Over-invoicing moves money, ask why.", "F2": "Ask."}
    flags = with_flag_notes(report.flags, notes.flag_notes)
    assert flags[0].evidence["ai_summary"] == "Over-invoicing moves money, ask why."
    assert flags[0].evidence.keys() > {"ai_summary"}  # the rule's own evidence is kept


def test_reply_is_cached_so_a_recheck_makes_no_call():
    _notes(FakeClient(json.dumps({"summary": "Cached summary."})))
    again = FakeClient(error=llm.LLMError("must not be called"))
    assert _notes(again).summary == "Cached summary."
    assert again.calls == []


def test_prose_reply_is_taken_as_the_summary():
    assert parse_reply("Line L1 is overpriced.", {"F1"}) == ("Line L1 is overpriced.", {})


def test_empty_or_broken_reply_falls_back_to_the_template():
    offline = _notes().summary
    assert _notes(FakeClient("   ")).summary == offline
    assert _notes(FakeClient('{"summary": ')).summary == offline
    assert _notes(FakeClient('{"flags": {}}')).summary == offline


def test_llm_failure_gives_no_summary():
    notes = _notes(FakeClient(error=llm.LLMError("HTTP 503")))
    assert notes.summary is None and notes.flag_notes == {}
    assert notes.warning and "unavailable" in notes.warning


def test_system_prompt_parts():
    assert '"flags"' in system_prompt(True) and '"flags"' not in system_prompt(False)
    assert "do not repeat them" in system_prompt(False)


def test_summary_client_uses_summary_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "big/model")
    monkeypatch.setenv("SUMMARY_MODEL", "small/model")
    client = llm.summary_client()
    assert isinstance(client, llm.OpenRouterClient)
    assert client.model == "small/model"
    assert client._retries == 0 and client._timeout == 10
