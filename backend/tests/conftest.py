import pytest


@pytest.fixture(autouse=True)
def _no_live_llm(monkeypatch):
    """Tests never call the LLM: default_proposer() falls back to the offline baseline."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
