"""AI flag summaries: one call per report, cached, never fatal."""

import json
from types import SimpleNamespace

from tbml.llm import LLMError
from tbml.schemas import Flag, Rule, Severity
from tbml.summarise import summarise, with_summaries


class FakeClient:
    model = "fake"

    def __init__(self, reply=None, fail=False):
        self.reply, self.fail, self.calls = reply, fail, []

    def complete(self, system, messages, max_tokens=0, **_):
        self.calls.append(messages[0]["content"])
        if self.fail:
            raise LLMError("down")
        return self.reply


def _flag(fid="R1-L1"):
    return Flag(
        flag_id=fid,
        rule=Rule.PRICE_OUTLIER,
        line_id="L1",
        severity=Severity.high,
        expected="$1",
        stated="$9",
        variance_pct=800.0,
        reason="Line L1 is priced about 9 times the usual import price.",
        evidence={"p90": 2},
    )


def _invoice():
    return SimpleNamespace(
        seller=SimpleNamespace(country="CN"),
        buyer=SimpleNamespace(country="GB"),
        consignee=None,
        currency="USD",
    )


def test_summary_lands_in_evidence_and_is_cached(tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path))
    reply = json.dumps({"summaries": {"R1-L1": "Over-invoicing moves money — ask why.", "X": "?"}})
    client = FakeClient(reply)
    flags = with_summaries(_invoice(), [_flag()], client)
    assert flags[0].evidence["ai_summary"] == "Over-invoicing moves money, ask why."
    assert flags[0].evidence["p90"] == 2  # rule evidence kept
    again = FakeClient(fail=True)  # cache hit: no call made
    assert summarise(_invoice(), [_flag()], again) == {
        "R1-L1": "Over-invoicing moves money, ask why."
    }
    assert again.calls == []


def test_failures_and_offline_leave_flags_untouched(tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path))
    flags = [_flag()]
    assert with_summaries(_invoice(), flags, FakeClient(fail=True)) == flags
    assert with_summaries(_invoice(), flags, FakeClient("not json")) == flags
    assert with_summaries(_invoice(), flags) == flags  # conftest removes every key: offline


def test_can_be_switched_off(tmp_path, monkeypatch):
    monkeypatch.setenv("TBML_CACHE_DIR", str(tmp_path))
    monkeypatch.setenv("TBML_FLAG_SUMMARIES", "0")
    client = FakeClient("{}")
    assert summarise(_invoice(), [_flag()], client) == {}
    assert client.calls == []
