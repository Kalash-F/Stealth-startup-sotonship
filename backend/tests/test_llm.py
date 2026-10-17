"""Shared LLM client (tbml/llm.py): OpenRouter request shape, errors, provider selection."""

from types import SimpleNamespace

import pytest
import requests

from tbml import llm
from tbml.classify import HierarchicalProposer, classify_description
from tbml.classify.proposers import KeywordProposer, LLMProposer, default_proposer


class FakeResp:
    def __init__(self, status, body):
        self.status_code, self._body = status, body
        self.text = str(body)

    def json(self):
        if isinstance(self._body, Exception):
            raise self._body
        return self._body


class FakeHTTP:
    """Returns queued responses (or raises queued exceptions) and records each request."""

    def __init__(self, *responses):
        self.responses, self.requests = list(responses), []

    def post(self, url, json, headers, timeout):
        self.requests.append(SimpleNamespace(url=url, json=json, headers=headers))
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


def ok(text, usage=None):
    return FakeResp(200, {"choices": [{"message": {"content": text}}], "usage": usage or {}})


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    monkeypatch.setattr(llm.time, "sleep", lambda s: None)


def test_request_shape_and_reply():
    http = FakeHTTP(ok("hello", {"total_tokens": 12}))
    client = llm.OpenRouterClient("some/model", "sk-or-test", session=http)
    assert (
        client.complete("be brief", [{"role": "user", "content": "hi"}], max_tokens=50) == "hello"
    )
    req = http.requests[0]
    assert req.url == llm.OPENROUTER_URL
    assert req.headers["Authorization"] == "Bearer sk-or-test"
    assert req.json["model"] == "some/model"
    assert req.json["messages"][0] == {"role": "system", "content": "be brief"}
    assert req.json["messages"][1] == {"role": "user", "content": "hi"}
    assert req.json["max_tokens"] == 50 and req.json["temperature"] == 0
    assert client.last_usage == {"total_tokens": 12}


def test_anthropic_style_shim_works_for_the_classifiers():
    http = FakeHTTP(ok('{"candidates": []}'))
    client = llm.OpenRouterClient("m", "k", session=http)
    msg = client.messages.create(
        model="other/model", system="s", max_tokens=10, messages=[{"role": "user", "content": "x"}]
    )
    assert msg.content[0].text == '{"candidates": []}'
    assert http.requests[0].json["model"] == "other/model"


def test_retries_rate_limit_then_succeeds():
    http = FakeHTTP(FakeResp(429, {"error": {"message": "slow down"}}), ok("done"))
    assert llm.OpenRouterClient("m", "k", session=http).complete("s", []) == "done"
    assert len(http.requests) == 2


def test_network_error_retried_then_raises():
    boom = requests.ConnectionError("offline")
    http = FakeHTTP(boom, boom, boom)
    with pytest.raises(llm.LLMError, match="network error"):
        llm.OpenRouterClient("m", "k", session=http).complete("s", [])
    assert len(http.requests) == 3


def test_auth_error_is_not_retried():
    http = FakeHTTP(FakeResp(401, {"error": {"message": "No auth credentials found"}}))
    with pytest.raises(llm.LLMError, match="HTTP 401: No auth credentials found"):
        llm.OpenRouterClient("m", "k", session=http).complete("s", [])
    assert len(http.requests) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"choices": []},
        {"choices": [{"message": {"content": ""}}]},
        {"error": {"message": "model not found"}},
    ],
)
def test_unusable_bodies_raise(body):
    with pytest.raises(llm.LLMError):
        llm.OpenRouterClient("m", "k", session=FakeHTTP(FakeResp(200, body))).complete("s", [])


def test_content_parts_are_joined():
    body = {
        "choices": [
            {"message": {"content": [{"type": "text", "text": "a"}, {"type": "text", "text": "b"}]}}
        ]
    }
    assert (
        llm.OpenRouterClient("m", "k", session=FakeHTTP(FakeResp(200, body))).complete("s", [])
        == "ab"
    )


def test_missing_key_or_model_rejected():
    with pytest.raises(llm.LLMError):
        llm.OpenRouterClient("", "k")
    with pytest.raises(llm.LLMError):
        llm.OpenRouterClient("m", "")


def test_provider_selection(monkeypatch):
    for var in ("OPENROUTER_MODEL", "LLM_MODEL"):
        monkeypatch.delenv(var, raising=False)
    assert llm.configured_client() is None and llm.describe_provider() == "offline"

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or")
    assert llm.configured_client() is None  # key without a model is not enough
    monkeypatch.setenv("OPENROUTER_MODEL", "vendor/model-x")
    client = llm.configured_client()
    assert isinstance(client, llm.OpenRouterClient)
    assert llm.describe_provider() == "openrouter:vendor/model-x"

    # OpenRouter wins over Anthropic when both are set
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant")
    monkeypatch.setenv("LLM_MODEL", "claude-x")
    assert isinstance(llm.configured_client(), llm.OpenRouterClient)


def test_default_proposer_uses_openrouter(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or")
    monkeypatch.setenv("OPENROUTER_MODEL", "vendor/model-x")
    monkeypatch.delenv("CLASSIFIER", raising=False)
    prop = default_proposer()
    assert isinstance(prop, HierarchicalProposer)
    assert isinstance(prop.client, llm.OpenRouterClient) and prop.model == "vendor/model-x"
    monkeypatch.setenv("CLASSIFIER", "flat")
    assert isinstance(default_proposer().inner, LLMProposer)
    monkeypatch.setenv("CLASSIFIER", "keyword")
    assert isinstance(default_proposer(), KeywordProposer)


def test_provider_outage_degrades_to_unclassified_not_crash(tmp_path):
    boom = requests.ConnectionError("offline")
    client = llm.OpenRouterClient("m", "k", session=FakeHTTP(boom, boom, boom))
    prop = HierarchicalProposer(client=client, cache_dir=tmp_path)
    cls = classify_description("MacBook Pro 14 M3", prop)
    assert cls.hs6 is None and "classifier unavailable" in cls.reason


def test_dotenv_is_off_in_tests(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    env.write_text("OPENROUTER_API_KEY=should-not-load\n")
    monkeypatch.setattr(llm, "REPO_ROOT", tmp_path)
    llm.load_dotenv()
    import os

    assert "OPENROUTER_API_KEY" not in os.environ
