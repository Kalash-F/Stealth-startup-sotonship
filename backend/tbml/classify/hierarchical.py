"""Three-step HS classification: chapter (2 digits) -> heading (4) -> subheading (6).

At each step the model picks from the real codes under the previous choice, so it can never
invent a code, and each step's choice and reason are recorded for the officer. If any step's
best score is below `min_step_score`, classification stops there and returns no candidates
("not sure"), which the classifier turns into hs6=None and the price check is skipped.

Confidence of a final code = the weakest step on its path (min of the step scores).
Every step call is cached on disk, so reruns and the offline demo cost nothing.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tbml.classify.nomenclature import LEVEL_NAMES, Nomenclature, default_nomenclature
from tbml.classify.proposers import ProposerError
from tbml.paths import DATA_DIR
from tbml.schemas import HS6Candidate

CACHE_DIR = DATA_DIR / "cache" / "classify_hier"
PROMPT_VERSION = "1"
MIN_STEP_SCORE = 0.5

_SYSTEM = (
    "You classify goods from a trade invoice line into the Harmonized System (HS), one level at a "
    "time. You are given the line description, the levels already chosen, and the options for the "
    "next level. Choose ONLY from the listed option codes. Use trade knowledge: brand names, model "
    "numbers, abbreviations and jargon (e.g. 'MBP 14 M3' is a laptop, 'hex cap scr A2-70' is a "
    "stainless steel bolt).\n"
    "Reply with JSON only, no prose:\n"
    '{"choices": [{"code": "<option code>", "score": <0 to 1>}], "reason": "<one short sentence>"}\n'
    "At most 3 choices, best first. The score is your probability that the choice is right. If no "
    "option fits, or the description is too vague to identify the goods (e.g. 'goods as per "
    'contract\', \'item 1\'), reply {"choices": [], "reason": "<why>"}.'
)


@dataclass
class Step:
    """One level of the walk down the tree."""

    level: str  # chapter / heading / subheading
    code: str | None
    description: str
    score: float
    reason: str
    alternatives: list[tuple[str, float]] = field(default_factory=list)


@dataclass
class Trace:
    """The full path for one description; `stopped` explains an early stop."""

    steps: list[Step] = field(default_factory=list)
    stopped: str = ""

    def summary(self) -> str:
        """e.g. '84 machinery (0.97) > 8471 computers (0.95) > 847130 portable (0.92)'."""
        parts = [f"{s.code} {s.description} ({s.score:.2f})" for s in self.steps if s.code]
        text = " > ".join(parts)
        if self.stopped:
            text = f"{text}; stopped: {self.stopped}" if text else f"stopped: {self.stopped}"
        return text


class HierarchicalProposer:
    """Proposer (see proposers.Proposer) that walks chapter -> heading -> subheading with an LLM."""

    def __init__(
        self,
        model: str | None = None,
        client: Any = None,
        nomenclature: Nomenclature | None = None,
        min_step_score: float = MIN_STEP_SCORE,
        cache_dir: Path | None = CACHE_DIR,
    ):
        self.model = model or os.environ.get("LLM_MODEL", "")
        if not self.model:
            raise ProposerError("LLM_MODEL is not set")
        if client is None:
            import anthropic

            client = anthropic.Anthropic()
        self.client = client
        self.nomenclature = nomenclature or default_nomenclature()
        self.min_step_score = min_step_score
        self.cache_dir = cache_dir
        self.traces: dict[str, Trace] = {}  # description -> last trace, for explanations

    # ---- public ---------------------------------------------------------------------------

    def propose(self, description: str) -> list[HS6Candidate]:
        trace = Trace()
        self.traces[description] = trace
        parent: str | None = None
        path_scores: list[float] = []

        for _ in range(3):
            options = self.nomenclature.children(parent)
            level = LEVEL_NAMES[len(options[0][0])] if options else "level"
            if not options:
                trace.stopped = f"no {level} options under {parent} in {self.nomenclature.source}"
                return []
            choices, reason = self._ask(description, parent, options)
            if not choices:
                trace.stopped = f"no {level} fits: {reason}"
                return []
            best_code, best_score = choices[0]
            if best_score < self.min_step_score:
                trace.steps.append(Step(level, None, "", best_score, reason, choices))
                trace.stopped = (
                    f"not sure at {level} level: best guess {best_code} scored "
                    f"{best_score:.2f}, below {self.min_step_score}"
                )
                return []
            trace.steps.append(
                Step(
                    level,
                    best_code,
                    self.nomenclature.describe(best_code),
                    best_score,
                    reason,
                    choices[1:],
                )
            )
            path_scores.append(best_score)
            if len(best_code) == 6:
                # final level: keep up to 3 subheadings, each capped by the weakest step above
                ceiling = min(path_scores[:-1]) if len(path_scores) > 1 else 1.0
                return [
                    HS6Candidate(hs6=code, score=round(min(score, ceiling), 4))
                    for code, score in choices
                ]
            parent = best_code
        return []

    def explain(self, description: str) -> str:
        """Human-readable path for the last classification of `description` ('' if none)."""
        trace = self.traces.get(description)
        return trace.summary() if trace else ""

    # ---- one LLM step ---------------------------------------------------------------------

    def _ask(
        self, description: str, parent: str | None, options: list[tuple[str, str]]
    ) -> tuple[list[tuple[str, float]], str]:
        valid = {code for code, _ in options}
        level = LEVEL_NAMES[len(options[0][0])]
        cached = self._cache_get(description, parent)
        if cached is not None:
            return cached

        chosen = []
        code = parent
        while code:
            chosen.append(f"{LEVEL_NAMES[len(code)]} {code}: {self.nomenclature.describe(code)}")
            code = code[:-2] if len(code) > 2 else None
        prompt = (
            f"Description: {description}\n"
            f"Already chosen: {'; '.join(reversed(chosen)) or 'nothing yet'}\n"
            f"Choose the {level} ({len(options[0][0])} digits). Options:\n"
            + "\n".join(f"{c}: {d}" for c, d in options)
        )

        error = ""
        for _ in range(2):  # one retry with the problem fed back
            content = prompt + (f"\n\nYour previous reply was invalid ({error})." if error else "")
            msg = self.client.messages.create(
                model=self.model,
                max_tokens=300,
                temperature=0,
                system=_SYSTEM,
                messages=[{"role": "user", "content": content}],
            )
            text = "".join(getattr(b, "text", "") for b in msg.content)
            try:
                result = _parse(text, valid)
            except ValueError as exc:
                error = str(exc)
                continue
            self._cache_put(description, parent, result)
            return result
        raise ProposerError(f"LLM gave an invalid {level} answer twice: {error}")

    # ---- cache ----------------------------------------------------------------------------

    def _cache_path(self, description: str, parent: str | None) -> Path | None:
        if self.cache_dir is None:
            return None
        norm = " ".join(description.lower().split())
        key = f"{self.model}\0{PROMPT_VERSION}\0{self.nomenclature.source}\0{parent}\0{norm}"
        return self.cache_dir / f"{hashlib.sha256(key.encode()).hexdigest()}.json"

    def _cache_get(self, description, parent):
        path = self._cache_path(description, parent)
        if path is None or not path.exists():
            return None
        data = json.loads(path.read_text())
        return [(c["code"], c["score"]) for c in data["choices"]], data["reason"]

    def _cache_put(self, description, parent, result):
        path = self._cache_path(description, parent)
        if path is None:
            return
        choices, reason = result
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "description": description,
            "parent": parent,
            "choices": [{"code": c, "score": s} for c, s in choices],
            "reason": reason,
        }
        path.write_text(json.dumps(payload, indent=2) + "\n")


def _parse(text: str, valid: set[str]) -> tuple[list[tuple[str, float]], str]:
    """Pull the JSON reply apart; drop codes not among the options; ValueError if malformed or if
    every proposed code was invalid."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object found")
    try:
        data = json.loads(text[start : end + 1])
        raw = data["choices"]
        reason = str(data.get("reason", ""))
        pairs = [(str(c["code"]).strip(), float(c["score"])) for c in raw]
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"malformed reply: {exc}") from exc
    if any(not 0 <= s <= 1 for _, s in pairs):
        raise ValueError("scores must be between 0 and 1")
    kept, seen = [], set()
    for code, score in sorted(pairs, key=lambda p: -p[1]):
        if code in valid and code not in seen:
            seen.add(code)
            kept.append((code, score))
    if pairs and not kept:
        raise ValueError(f"none of {[c for c, _ in pairs]} is a listed option")
    return kept[:3], reason
