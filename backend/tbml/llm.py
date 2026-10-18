"""One LLM client for the whole backend (classification, extraction, report summaries).

Provider order, read from the environment or the repo-root .env:
  1. OpenRouter  - OPENROUTER_API_KEY + OPENROUTER_MODEL (or LLM_MODEL)
  2. Anthropic   - ANTHROPIC_API_KEY + LLM_MODEL
  3. none        - callers fall back to their offline path (keyword classifier, layout parser)

SUMMARY_MODEL optionally picks a smaller, faster model for the report summary only.

Jev (TypeSafe's decision model, used for HS classification) is NOT a chat model: it answers typed
questions with probabilities on OpenRouter's Decisions API. It has its own client (JevClient), its
own env var (JEV_MODEL) and shares only the OpenRouter key. A Jev id in OPENROUTER_MODEL, LLM_MODEL
or SUMMARY_MODEL is ignored with a warning, so chat calls can never be sent to it.

Every client exposes:
  - complete(system, messages, max_tokens) -> reply text
  - messages.create(model=, system=, messages=, max_tokens=, temperature=) -> object with
    .content[0].text, the Anthropic-SDK shape the classifiers already use.

OpenRouter's chat-completions API is OpenAI-compatible and is called with the standard library
(urllib), so the deployed function needs no HTTP package (the Vercel bundle drops `requests`).
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import urllib.error
import urllib.request
from types import SimpleNamespace
from typing import Any

from tbml.paths import REPO_ROOT

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
JEV_URL = "https://openrouter.ai/api/alpha/decisions"
DEFAULT_JEV_MODEL = "typesafe/jev-1.14"  # pinned, not ~typesafe/jev-latest, so caches stay valid
APP_TITLE = "TBML Invoice Checker"
TIMEOUT_S = 60
RETRY_STATUSES = {429, 500, 502, 503, 504}

log = logging.getLogger("tbml.llm")


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


# ---- HTTP ------------------------------------------------------------------------------------


class _Response:
    """Just enough of a response for OpenRouterClient: status_code, text, json()."""

    def __init__(self, status_code: int, text: str):
        self.status_code, self.text = status_code, text

    def json(self) -> Any:
        return json.loads(self.text)


class _UrllibSession:
    """Minimal `post(url, json=, headers=, timeout=)` over urllib. Network failures raise
    OSError (URLError, timeouts); HTTP error statuses come back as responses."""

    def post(self, url: str, json: Any, headers: dict[str, str], timeout: float) -> _Response:
        body = _json_dumps(json).encode()
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return _Response(resp.status, resp.read().decode("utf-8", "replace"))
        except urllib.error.HTTPError as exc:
            return _Response(exc.code, exc.read().decode("utf-8", "replace"))


def _json_dumps(obj: Any) -> str:
    return json.dumps(obj)


# ---- OpenRouter ------------------------------------------------------------------------------


class OpenRouterClient:
    """Chat completions through OpenRouter (https://openrouter.ai), any model it lists."""

    provider = "openrouter"

    def __init__(
        self,
        model: str,
        api_key: str,
        session: Any = None,
        retries: int = 2,
        timeout: float = TIMEOUT_S,
    ):
        if not model:
            raise LLMError("no OpenRouter model set (OPENROUTER_MODEL)")
        if not api_key:
            raise LLMError("no OpenRouter key set (OPENROUTER_API_KEY)")
        self.model = model
        self._key = api_key
        self._http = session or _UrllibSession()
        self._retries = retries
        self._timeout = timeout
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
                    OPENROUTER_URL, json=payload, headers=headers, timeout=self._timeout
                )
            except OSError as exc:  # URLError, timeouts, connection resets (requests' errors too)
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


# ---- Jev (decisions, not chat) ---------------------------------------------------------------


class JevClient:
    """TypeSafe's Jev through OpenRouter's Decisions API: typed questions (choice / noul / score)
    against a `state`, answered with probabilities. Deliberately has no complete()/messages, so
    it can never stand in for a chat client."""

    provider = "jev"

    def __init__(
        self,
        model: str,
        api_key: str,
        session: Any = None,
        retries: int = 2,
        timeout: float = 30,
    ):
        if not api_key:
            raise LLMError("no OpenRouter key set (OPENROUTER_API_KEY)")
        self.model = model or DEFAULT_JEV_MODEL
        self._key = api_key
        self._http = session or _UrllibSession()
        self._retries = retries
        self._timeout = timeout
        self.last_usage: dict[str, Any] = {}
        self.spent_usd = 0.0  # sum of usage.cost over this client's calls (beams run in threads)
        self._lock = threading.Lock()

    def decide(self, state: Any, questions: dict[str, dict[str, Any]]) -> dict[str, dict]:
        """POST one request; returns `answers` keyed by question id."""
        payload = {"model": self.model, "state": state, "questions": questions}
        headers = {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "X-Title": APP_TITLE,
        }
        last = ""
        for attempt in range(self._retries + 1):
            try:
                resp = self._http.post(
                    JEV_URL, json=payload, headers=headers, timeout=self._timeout
                )
            except OSError as exc:
                last = f"network error: {exc}"
            else:
                if resp.status_code == 200:
                    return self._answers(resp, questions)
                last = f"HTTP {resp.status_code}: {_error_message(resp)}"
                if resp.status_code not in RETRY_STATUSES | {529}:  # 529: Jev overloaded
                    break
            if attempt < self._retries:
                time.sleep(1.5 * (attempt + 1))
        raise LLMError(f"Jev request failed ({last})")

    def _answers(self, resp: Any, questions: dict[str, Any]) -> dict[str, dict]:
        try:
            data = resp.json()
        except ValueError as exc:
            raise LLMError("Jev returned non-JSON") from exc
        if "error" in data:
            raise LLMError(f"Jev error: {data['error']}")
        self.last_usage = data.get("usage") or {}
        with self._lock:
            self.spent_usd += float(self.last_usage.get("cost") or 0)
        answers = data.get("answers")
        if not isinstance(answers, dict) or any(q not in answers for q in questions):
            raise LLMError("Jev reply is missing answers")
        return answers


def is_decision_model(model: str | None) -> bool:
    """True for Jev ids (typesafe/..., ~typesafe/...), which must never be used for chat."""
    return bool(model) and model.lstrip("~").startswith("typesafe/")


def jev_client() -> JevClient | None:
    """Jev on the OpenRouter key, model JEV_MODEL (default DEFAULT_JEV_MODEL); None without a key."""
    load_dotenv()
    key = os.environ.get("OPENROUTER_API_KEY")
    return JevClient(os.environ.get("JEV_MODEL") or DEFAULT_JEV_MODEL, key) if key else None


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
    or_model = _chat_model(os.environ.get("OPENROUTER_MODEL") or os.environ.get("LLM_MODEL"))
    if or_key and or_model:
        return OpenRouterClient(or_model, or_key)
    an_key, an_model = os.environ.get("ANTHROPIC_API_KEY"), _chat_model(os.environ.get("LLM_MODEL"))
    if an_key and an_model:
        return AnthropicClient(an_model, an_key)
    return None


def summary_client(timeout: float = 10) -> OpenRouterClient | AnthropicClient | None:
    """Like configured_client(), but with SUMMARY_MODEL when set, a short timeout and no retries:
    the summary is optional and must not hold the report back."""
    client = configured_client()
    model = _chat_model(os.environ.get("SUMMARY_MODEL"))
    if isinstance(client, OpenRouterClient):
        return OpenRouterClient(model or client.model, client._key, retries=0, timeout=timeout)
    if client and model:
        client.model = model
    return client


def _chat_model(model: str | None) -> str | None:
    """`model`, unless it is a Jev id (a decision model cannot answer chat calls)."""
    if is_decision_model(model):
        log.warning("%s is a decision model; set it as JEV_MODEL, not as a chat model", model)
        return None
    return model


def describe_provider() -> str:
    """'openrouter:<model>', 'anthropic:<model>' or 'offline', for /health and logs."""
    client = configured_client()
    return f"{client.provider}:{client.model}" if client else "offline"
