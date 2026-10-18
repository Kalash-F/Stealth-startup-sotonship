"""Report.summary (tbml/summary.py): LLM reply, offline template, failure fallback."""

import json

from tbml import llm
from tbml.fixtures import load_fixture
from tbml.schemas import PriorityBand, Report
from tbml.summary import summarise


class FakeClient:
    def __init__(self, reply=None, error=None):
        self.reply, self.error, self.calls = reply, error, []

    def complete(self, system, messages, max_tokens=8192, temperature=0, model=None):
        self.calls.append((system, messages, max_tokens))
        if self.error:
            raise self.error
        return self.reply


def _report() -> Report:
    return Report.model_validate(load_fixture("report"))


def _args(report: Report):
    return report.priority_score, report.priority_band, report.flags, report.lines, report.warnings


def test_template_when_offline():
    text, warning = summarise(*_args(_report()))
    assert warning is None
    assert text.startswith("Review now (score 80):")
    assert "price outlier" in text and "L1" in text


def test_template_clean_invoice():
    text, warning = summarise(0, PriorityBand.low, [], [], [])
    assert (text, warning) == ("Low priority (score 0): no red flags raised.", None)


def test_template_mentions_warnings():
    text, _ = summarise(0, PriorityBand.low, [], [], ["line L2 could not be classified"])
    assert text.endswith("1 check could not run fully.")


def test_llm_reply_is_used_and_tidied():
    client = FakeClient("  Review now: line L1 is\n badly overpriced.  ")
    text, warning = summarise(*_args(_report()), client=client)
    assert (text, warning) == ("Review now: line L1 is badly overpriced.", None)
    _system, messages, max_tokens = client.calls[0]
    facts = json.loads(messages[0]["content"])
    assert facts["priority_score"] == 80 and facts["priority_band"] == "Review now"
    assert facts["flags"][0]["rule"] == "PRICE_OUTLIER"
    assert "evidence" not in facts["flags"][0]  # prompt stays small
    assert max_tokens <= 200


def test_empty_llm_reply_falls_back():
    text, warning = summarise(*_args(_report()), client=FakeClient("   "))
    assert text.startswith("Review now (score 80):") and warning is None


def test_llm_failure_gives_no_summary():
    client = FakeClient(error=llm.LLMError("HTTP 503"))
    text, warning = summarise(*_args(_report()), client=client)
    assert text is None
    assert warning and "unavailable" in warning


def test_summary_client_uses_summary_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "big/model")
    monkeypatch.setenv("SUMMARY_MODEL", "small/model")
    client = llm.summary_client()
    assert isinstance(client, llm.OpenRouterClient)
    assert client.model == "small/model"
    assert client._retries == 0 and client._timeout == 10


def test_summary_client_defaults_to_main_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.setenv("OPENROUTER_MODEL", "big/model")
    monkeypatch.delenv("SUMMARY_MODEL", raising=False)
    assert llm.summary_client().model == "big/model"


def test_summary_client_offline():
    assert llm.summary_client() is None
