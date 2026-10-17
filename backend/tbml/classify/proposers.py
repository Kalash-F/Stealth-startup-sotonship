"""Candidate proposers: something that turns a description into scored HS6 guesses.

`KeywordProposer` is a deterministic offline baseline. `AnthropicProposer` is the LLM path
(plan 3.7). `CachedProposer` stores answers on disk so reruns are free and deterministic.
Proposals are untrusted: `classify_description` validates them against hs6.csv.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Protocol

from tbml.classify.hs6 import HS6Entry, default_hs6
from tbml.paths import cache_dir as default_cache_dir
from tbml.schemas import HS6Candidate

PROMPT_VERSION = "1"


class ProposerError(RuntimeError):
    """The proposer could not produce a usable answer."""


class Proposer(Protocol):
    """Anything that can turn a description into scored HS6 guesses (best first, at most 3)."""

    def propose(self, description: str) -> list[HS6Candidate]: ...


_NOT_DECAF = re.compile(r"\b(?:not|non)[- ]decaf\w*")


class KeywordProposer:
    """Offline baseline: score = 1 - 0.4**keyword_hits, so one hit 0.6, two 0.84."""

    def __init__(self, entries: dict[str, HS6Entry] | None = None):
        self.entries = entries if entries is not None else default_hs6()

    def propose(self, description: str) -> list[HS6Candidate]:
        text = _NOT_DECAF.sub(" ", description.lower())
        scored: list[HS6Candidate] = []
        for entry in self.entries.values():
            if entry.exclude and entry.exclude.search(text):
                continue
            hits = sum(1 for kw in entry.keywords if kw.search(text))
            if hits:
                scored.append(HS6Candidate(hs6=entry.hs6, score=round(1 - 0.4**hits, 4)))
        scored.sort(key=lambda c: (-c.score, c.hs6))
        return scored[:3]


_SYSTEM = (
    "You classify goods from trade invoice line descriptions into HS6 codes (Harmonized System, "
    "6 digits). Reply with JSON only: "
    '{"candidates": [{"hs6": "<6 digits>", "score": <0 to 1>}]}, at most 3 candidates, best '
    "first. The score is your probability that the code is right. If the description is too "
    'vague to classify, reply {"candidates": []}. Never guess a code for generic wording.'
)


class AnthropicProposer:
    """Asks an Anthropic model for HS6 candidates as JSON; retries once with the parse error fed
    back."""

    def __init__(self, model: str | None = None, client: Any = None):
        self.model = model or os.environ.get("LLM_MODEL", "")
        if not self.model:
            raise ProposerError("LLM_MODEL is not set")
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        self.client = client

    def propose(self, description: str) -> list[HS6Candidate]:
        error = ""
        for _ in range(2):  # one retry with the error fed back (plan 2.2 pattern)
            content = f"Description: {description}"
            if error:
                content += f"\n\nYour previous reply was invalid ({error}). Reply with JSON only."
            msg = self.client.messages.create(
                model=self.model,
                max_tokens=300,
                temperature=0,
                system=_SYSTEM,
                messages=[{"role": "user", "content": content}],
            )
            text = "".join(getattr(b, "text", "") for b in msg.content)
            try:
                return _parse(text)
            except ValueError as exc:
                error = str(exc)
        raise ProposerError(f"LLM returned invalid JSON twice: {error}")


def _parse(text: str) -> list[HS6Candidate]:
    """Pull the JSON object out of a model reply and validate it; ValueError on anything
    malformed."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object found")
    try:
        data = json.loads(text[start : end + 1])
        return [HS6Candidate(**c) for c in data["candidates"]][:3]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(str(exc)) from exc


class CachedProposer:
    """Disk cache keyed by (model, prompt version, normalised description). The default directory
    is `<cache root>/classify`, resolved when the proposer is built so $TBML_CACHE_DIR applies."""

    def __init__(self, inner: Proposer, cache_dir: Path | None = None, model: str = ""):
        self.inner, self.model = inner, model
        self.cache_dir = cache_dir or default_cache_dir() / "classify"

    def _path(self, description: str) -> Path:
        """Cache file for a description; whitespace and case are normalised before hashing."""
        key = f"{self.model}\0{PROMPT_VERSION}\0{' '.join(description.lower().split())}"
        return self.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.json"

    def propose(self, description: str) -> list[HS6Candidate]:
        """Cached answer if present, else ask the inner proposer and store its answer."""
        path = self._path(description)
        if path.exists():
            return [HS6Candidate(**c) for c in json.loads(path.read_text())["candidates"]]
        candidates = self.inner.propose(description)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        payload = {"description": description, "candidates": [c.model_dump() for c in candidates]}
        path.write_text(json.dumps(payload, indent=2) + "\n")
        return candidates


def default_proposer() -> Proposer:
    """LLM (cached) when ANTHROPIC_API_KEY and LLM_MODEL are set, else the offline baseline."""
    model = os.environ.get("LLM_MODEL", "")
    if os.environ.get("ANTHROPIC_API_KEY") and model:
        return CachedProposer(AnthropicProposer(model), model=model)
    return KeywordProposer()
