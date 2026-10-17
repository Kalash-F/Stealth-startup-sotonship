"""One LLM client for the whole backend (classification, extraction, and later flag summaries).

Provider order, read from the environment or the repo-root .env:
  1. OpenRouter  - OPENROUTER_API_KEY + OPENROUTER_MODEL (or LLM_MODEL)
  2. Anthropic   - ANTHROPIC_API_KEY + LLM_MODEL
  3. none        - callers fall back to their offline path (keyword classifier, layout parser)

Every client exposes:
  - complete(system, messages, max_tokens) -> reply text
  - messages.create(model=, system=, messages=, max_tokens=, temperature=) -> object with
    .content[0].text, the Anthropic-SDK shape the classifiers already use.

OpenRouter's chat-completions API is OpenAI-compatible, so no extra dependency is needed.
"""

from __future__ import annotations

import os
import time
from types import SimpleNamespace
from typing import Any

import requests

from tbml.paths import REPO_ROOT

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
APP_TITLE = "TBML Invoice Checker"
TIMEOUT_S = 60
RETRY_STATUSES = {429, 500, 502, 503, 504}


class LLMError(RuntimeError):
    """The provider could not return a usable reply (network, auth, quota, empty answer)."""


# ---- .env ------------------------------------------------------------------------------------


def load_dotenv() -> None:
    """Copy KEY=value lines from the repo-root .env into os.environ without overriding real env
    vars. Disabled when TBML_NO_DOTENV is set (the test suite sets it)."""
    if os.environ.get("TBML_NO_DOTENV"):
        return
    env = REPO_ROOT / ".env"
    if not env.is_file():
        return
    for raw in env.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if value.strip():
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


# ---- shared shim -----------------------------------------------------------------------------


class _MessagesShim:
    """Gives any client an Anthropic-style `messages.create(...)`."""

    def __init__(self, owner: Any):
        self._owner = owner

    def create(
        self,
        *,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 1024,
        model: str | None = None,
        temperature: float = 0,
        **_: Any,
    ) -> SimpleNamespace:
        text = self._owner.complete(
            system, messages, max_tokens=max_tokens, temperature=temperature, model=model
        )
        return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


# ---- OpenRouter ------------------------------------------------------------------------------


class OpenRouterClient:
    """Chat completions through OpenRouter (https://openrouter.ai), any model it lists."""

    provider = "openrouter"

    def __init__(self, model: str, api_key: str, session: Any = None, retries: int = 2):
        if not model:
            raise LLMError("no OpenRouter model set (OPENROUTER_MODEL)")
        if not api_key:
            raise LLMError("no OpenRouter key set (OPENROUTER_API_KEY)")
        self.model = model
        self._key = api_key
        self._http = session or requests
        self._retries = retries
        self.messages = _MessagesShim(self)
        self.last_usage: dict[str, Any] = {}

    def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 8192,
        temperature: float = 0,
        model: str | None = None,
    ) -> str:
        payload = {
            "model": model or self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        headers = {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "X-Title": APP_TITLE,
        }
        referer = os.environ.get("OPENROUTER_REFERER")
        if referer:
            headers["HTTP-Referer"] = referer

        last = ""
        for attempt in range(self._retries + 1):
            try:
                resp = self._http.post(
                    OPENROUTER_URL, json=payload, headers=headers, timeout=TIMEOUT_S
                )
            except requests.RequestException as exc:
                last = f"network error: {exc}"
            else:
                if resp.status_code == 200:
                    return self._text(resp)
                last = f"HTTP {resp.status_code}: {_error_message(resp)}"
                if resp.status_code not in RETRY_STATUSES:
                    break  # auth, bad model, bad request: retrying will not help
            if attempt < self._retries:
                time.sleep(1.5 * (attempt + 1))
        raise LLMError(f"OpenRouter request failed ({last})")

    def _text(self, resp: Any) -> str:
        try:
            data = resp.json()
        except ValueError as exc:
            raise LLMError("OpenRouter returned non-JSON") from exc
        if "error" in data:
            raise LLMError(f"OpenRouter error: {data['error']}")
        self.last_usage = data.get("usage") or {}
        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMError("OpenRouter reply had no message content") from exc
        if isinstance(content, list):  # some providers return content parts
            content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
        if not content:
            raise LLMError("OpenRouter returned an empty reply")
        return content


def _error_message(resp: Any) -> str:
    try:
        err = resp.json().get("error", {})
        return err.get("message", str(err)) if isinstance(err, dict) else str(err)
    except ValueError:
        return (getattr(resp, "text", "") or "")[:200]


# ---- Anthropic (fallback) ---------------------------------------------------------------------


class AnthropicClient:
    """Anthropic Messages API (temperature 0 where the model allows it)."""

    provider = "anthropic"

    def __init__(self, model: str, api_key: str | None = None):
        import anthropic

        self._anthropic = anthropic
        self.model = model
        self._client = anthropic.Anthropic(api_key=api_key)
        self.messages = _MessagesShim(self)

    def complete(
        self,
        system: str,
        messages: list[dict[str, str]],
        max_tokens: int = 8192,
        temperature: float = 0,
        model: str | None = None,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": model or self.model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        try:
            try:
                resp = self._client.messages.create(temperature=temperature, **kwargs)
            except self._anthropic.BadRequestError as exc:
                if "temperature" not in str(exc).lower():
                    raise
                resp = self._client.messages.create(**kwargs)  # model rejects temperature
        except self._anthropic.APIError as exc:
            raise LLMError(f"Anthropic request failed: {exc}") from exc
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


# ---- selection -------------------------------------------------------------------------------


def configured_client() -> OpenRouterClient | AnthropicClient | None:
    """The client the environment asks for, or None when no provider is configured."""
    load_dotenv()
    or_key = os.environ.get("OPENROUTER_API_KEY")
    or_model = os.environ.get("OPENROUTER_MODEL") or os.environ.get("LLM_MODEL")
    if or_key and or_model:
        return OpenRouterClient(or_model, or_key)
    an_key, an_model = os.environ.get("ANTHROPIC_API_KEY"), os.environ.get("LLM_MODEL")
    if an_key and an_model:
        return AnthropicClient(an_model, an_key)
    return None


def describe_provider() -> str:
    """'openrouter:<model>', 'anthropic:<model>' or 'offline', for /health and logs."""
    client = configured_client()
    return f"{client.provider}:{client.model}" if client else "offline"
