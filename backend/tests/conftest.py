import pytest


@pytest.fixture(autouse=True)
def _no_live_llm(monkeypatch):
    """Tests never call the LLM: default_proposer() falls back to the offline baseline."""
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("TBML_NO_DOTENV", "1")  # a real .env must never leak a key into tests
