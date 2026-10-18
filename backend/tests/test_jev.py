"""Jev classifier (tbml/classify/jev.py) and client (tbml/llm.py): request shape, beam search,
"none" handling, interpretation, caching, and keeping Jev apart from the chat model."""

import json
from types import SimpleNamespace

import pytest

from tbml import llm
from tbml.classify import (
    HierarchicalProposer,
    JevProposer,
    classify_description,
    describe_classifier,
)
from tbml.classify.hs6 import HS6Entry
from tbml.classify.jev import NONE
from tbml.classify.nomenclature import load_nomenclature
from tbml.classify.proposers import KeywordProposer, ProposerError, default_proposer

NOMENCLATURE = """code,description
84,"Nuclear reactors, boilers, machinery and mechanical appliances"
85,Electrical machinery and equipment
73,Articles of iron or steel
8471,Automatic data processing machines
8473,Parts for office machines
847130,"Portable automatic data processing machines, weighing not more than 10 kg"
847141,"Other, comprising a CPU and an input and output unit"
847330,Parts and accessories of machines of heading 8471
8523,Discs and solid-state storage devices
852351,Solid-state non-volatile storage devices
7318,"Screws, bolts, nuts and similar articles, of iron or steel"
731815,"Other screws and bolts, whether or not with their nuts or washers"
731816,Nuts
"""


@pytest.fixture
def nom(tmp_path):
    path = tmp_path / "hs.csv"
    path.write_text(NOMENCLATURE)
    return load_nomenclature(path)


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)


class FakeJev:
    """Answers each Choice from `script`: parent code (None for chapters) -> probabilities."""

    model = "typesafe/jev-test"

    def __init__(self, script):
        self.script, self.calls = script, []

    def decide(self, state, questions):
        q = questions["hs"]
        self.calls.append((state, q))
        options = [c for c in q["criteria"] if c != NONE]
        # the parent is the longest scripted code that prefixes every option (None: chapters)
        parents = [c for c in self.script if c and all(o.startswith(c) for o in options)]
        probs = self.script[max(parents, key=len) if parents else None]
        return {"hs": {"type": "choice", "probabilities": probs, "confidence": 0.8}}


class FakeChat:
    """Chat model for the interpret step only."""

    model = "chat/model"

    def __init__(self, goods="", vague=False):
        self.reply, self.calls = json.dumps({"goods": goods, "vague": vague}), []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(text=self.reply)])


def _proposer(script, nom, tmp_path, chat=None):
    return JevProposer(jev=FakeJev(script), chat=chat, nomenclature=nom, cache_dir=tmp_path / "c")


def _entries(nom):
    return {c: HS6Entry(c, d, (), None) for c, d in nom.hs6_codes().items()}


MACBOOK = {
    None: {"84": 0.9, "85": 0.05, "73": 0.03, NONE: 0.02},
    "84": {"8471": 0.95, "8473": 0.05},
    "8471": {"847130": 0.92, "847141": 0.08},
    "7318": {"731815": 0.5, "731816": 0.5},
}


# ---- beam search ---------------------------------------------------------------------------


def test_walks_three_levels_ranked_by_geometric_mean(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path)
    cands = p.propose("MBP 14 M3 16/512 SG")
    assert [c.hs6 for c in cands] == ["847130", "847141", "847330"]
    assert cands[0].score == pytest.approx((0.9 * 0.95 * 0.92) ** (1 / 3), abs=1e-4)
    # 847330 is the only child of 8473: forced, so only two decisions count
    assert cands[2].score == pytest.approx((0.9 * 0.05) ** 0.5, abs=1e-4)
    # chapter, heading under 84, subheading under 8471; single-child levels made no call
    assert len(p.jev.calls) == 3
    path = p.explain("MBP 14 M3 16/512 SG")
    assert path.startswith("84 ") and "> 8471 " in path and "> 847130 " in path


def test_request_carries_options_none_and_path(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path)
    p.propose("MBP 14 M3")
    state, q = p.jev.calls[1]
    assert q["type"] == "choice" and "heading" in q["instructions"]
    assert set(q["criteria"]) == {"8471", "8473", NONE}
    assert q["criteria"]["8471"] == "Automatic data processing machines"
    assert state["invoice_line"] == "MBP 14 M3"
    assert state["classified_so_far"].startswith("chapter 84:")


def test_beam_recovers_from_a_wrong_first_chapter(nom, tmp_path):
    script = {
        None: {"73": 0.5, "84": 0.45, NONE: 0.05},
        "84": {"8471": 0.98, "8473": 0.02},
        "7318": {"731815": 0.3, "731816": 0.3, NONE: 0.4},
        "8471": {"847130": 0.97, "847141": 0.03},
    }
    p = _proposer(script, nom, tmp_path)
    cls = classify_description("MacBook Pro 14", p, entries=_entries(nom))
    assert cls.hs6 == "847130"  # greedy would have gone down chapter 73


def test_mass_on_none_leaves_the_line_unclassified(nom, tmp_path):
    script = {
        None: {"84": 0.3, NONE: 0.7},
        "84": {"8471": 0.4, NONE: 0.6},
        "8471": {"847130": 0.5, NONE: 0.5},
    }
    cls = classify_description("odd thing", _proposer(script, nom, tmp_path), entries=_entries(nom))
    assert cls.hs6 is None and "below 0.5" in cls.reason


def test_all_none_stops_with_a_reason(nom, tmp_path):
    p = _proposer({None: {NONE: 1.0}}, nom, tmp_path)
    cls = classify_description("unobtainium", p, entries=_entries(nom))
    assert cls.hs6 is None and "no chapter fits" in cls.reason


def test_jev_failure_is_classifier_unavailable(nom, tmp_path):
    class Down(FakeJev):
        def decide(self, state, questions):
            raise llm.LLMError("HTTP 529")

    p = JevProposer(jev=Down({}), nomenclature=nom, cache_dir=tmp_path)
    cls = classify_description("MacBook", p, entries=_entries(nom))
    assert cls.hs6 is None and "classifier unavailable" in cls.reason


def test_too_many_options_is_rejected(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path)
    with pytest.raises(ProposerError, match="limit"):
        p._choose({}, None, [(f"{i:02d}", "x") for i in range(255)])


# ---- interpretation and cache ---------------------------------------------------------------


def test_reading_goes_into_the_state(nom, tmp_path):
    chat = FakeChat(goods="An Apple laptop computer")
    p = _proposer(MACBOOK, nom, tmp_path, chat=chat)
    p.propose("MBP 14 M3")
    assert all(state["what_it_is"] == "An Apple laptop computer" for state, _ in p.jev.calls)
    assert p.explain("MBP 14 M3").startswith('read as "An Apple laptop computer"')


def test_vague_line_never_reaches_jev(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path, chat=FakeChat(vague=True))
    assert p.propose("spare parts") == [] and p.jev.calls == []
    assert "too vague" in p.explain("spare parts")


def test_no_chat_model_means_no_reading(nom, tmp_path):
    p = _proposer(MACBOOK, nom, tmp_path)
    p.propose("MBP 14 M3")
    assert all("what_it_is" not in state for state, _ in p.jev.calls)


def test_answers_are_cached_on_disk(nom, tmp_path):
    first = _proposer(MACBOOK, nom, tmp_path)
    first.propose("MBP 14 M3")
    second = _proposer(MACBOOK, nom, tmp_path)
    assert [c.hs6 for c in second.propose("MBP 14 M3")] == ["847130", "847141", "847330"]
    assert second.jev.calls == []


# ---- client ---------------------------------------------------------------------------------


class FakeResp:
    def __init__(self, status, body):
        self.status_code, self._body, self.text = status, body, str(body)

    def json(self):
        return self._body


class FakeHTTP:
    def __init__(self, *responses):
        self.responses, self.requests = list(responses), []

    def post(self, url, json, headers, timeout):
        self.requests.append(SimpleNamespace(url=url, json=json, headers=headers))
        return self.responses.pop(0)


def _ok(cost=0.00002):
    answer = {"type": "choice", "choice": "84", "probabilities": {"84": 1.0}, "confidence": 1.0}
    return FakeResp(200, {"answers": {"hs": answer}, "usage": {"input_tokens": 9, "cost": cost}})


QUESTION = {"hs": {"type": "choice", "instructions": "?", "criteria": {"84": "machines"}}}


def test_client_request_shape_and_cost():
    http = FakeHTTP(_ok(), _ok())
    jev = llm.JevClient("typesafe/jev-1.14", "sk-or", session=http)
    answers = jev.decide({"invoice_line": "laptop"}, QUESTION)
    jev.decide({"invoice_line": "laptop"}, QUESTION)
    assert answers["hs"]["choice"] == "84"
    req = http.requests[0]
    assert req.url == llm.JEV_URL
    assert req.headers["Authorization"] == "Bearer sk-or"
    assert req.json == {
        "model": "typesafe/jev-1.14",
        "state": {"invoice_line": "laptop"},
        "questions": QUESTION,
    }
    assert jev.last_usage["cost"] == 0.00002 and jev.spent_usd == pytest.approx(0.00004)


def test_client_retries_overload_but_not_auth():
    http = FakeHTTP(FakeResp(529, {"error": {"message": "overloaded"}}), _ok())
    assert llm.JevClient("m", "k", session=http).decide({}, QUESTION)["hs"]["choice"] == "84"
    http = FakeHTTP(FakeResp(401, {"error": {"message": "bad key"}}))
    with pytest.raises(llm.LLMError, match="401"):
        llm.JevClient("m", "k", session=http).decide({}, QUESTION)
    assert len(http.requests) == 1


def test_client_rejects_missing_answers():
    http = FakeHTTP(FakeResp(200, {"answers": {}}))
    with pytest.raises(llm.LLMError, match="missing answers"):
        llm.JevClient("m", "k", session=http).decide({}, QUESTION)


# ---- keeping Jev and the chat model apart ---------------------------------------------------


def test_jev_client_cannot_chat():
    jev = llm.JevClient("typesafe/jev-1.14", "k")
    assert not hasattr(jev, "complete") and not hasattr(jev, "messages")


def test_jev_id_is_never_used_as_a_chat_model(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or")
    monkeypatch.setenv("OPENROUTER_MODEL", "typesafe/jev-1.14")
    assert llm.configured_client() is None
    monkeypatch.setenv("OPENROUTER_MODEL", "chat/model")
    monkeypatch.setenv("SUMMARY_MODEL", "~typesafe/jev-latest")
    assert llm.summary_client().model == "chat/model"


def test_default_classifier_is_jev(monkeypatch):
    monkeypatch.delenv("CLASSIFIER", raising=False)
    monkeypatch.delenv("JEV_MODEL", raising=False)
    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    assert isinstance(default_proposer(), KeywordProposer)  # no key: offline
    assert describe_classifier() == "keyword"

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or")
    prop = default_proposer()
    assert isinstance(prop, JevProposer) and prop.jev.model == llm.DEFAULT_JEV_MODEL
    assert prop.chat is None  # no chat model: placeholder gate only, no reading
    assert describe_classifier() == f"jev:{llm.DEFAULT_JEV_MODEL}"

    monkeypatch.setenv("OPENROUTER_MODEL", "chat/model")
    monkeypatch.setenv("JEV_MODEL", "typesafe/jev-1.13")
    prop = default_proposer()
    assert prop.jev.model == "typesafe/jev-1.13" and prop.chat.model == "chat/model"

    monkeypatch.setenv("CLASSIFIER", "hierarchical")
    assert isinstance(default_proposer(), HierarchicalProposer)
    assert describe_classifier() == "hierarchical:chat/model"
