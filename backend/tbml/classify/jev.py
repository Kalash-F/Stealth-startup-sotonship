"""HS classification with Jev (TypeSafe's decision model): chapter -> heading -> subheading.

Same front end as the three-step chat classifier (placeholder gate, then a chat model's plain-words
reading of the line, which can stop a vague line), but every level is decided by Jev: one Choice
question over the real child codes plus "none", answered with a probability per option.

Beam search (TypeSafe's hierarchical-classification cookbook): the top `beam_width` paths survive
each level, ranked by the geometric mean of their step probabilities; levels with a single child
are taken without a call and not counted. A beam's questions at one level run in parallel. Mass on
"none" lowers every real option, so goods that fit nowhere end with low scores and the classifier's
0.5 floor leaves them unclassified.
"""

from __future__ import annotations

import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tbml.classify.hierarchical import (
    CACHE_SUBDIR,
    PROMPT_VERSION,
    Step,
    Trace,
    _short,
    cache_path,
    interpret,
)
from tbml.classify.nomenclature import LEVEL_NAMES, Nomenclature, default_nomenclature
from tbml.classify.proposers import ProposerError
from tbml.llm import LLMError
from tbml.paths import cache_dir as default_cache_dir
from tbml.schemas import HS6Candidate

log = logging.getLogger("tbml.classify.jev")

JEV_CACHE_SUBDIR = "classify_jev"
JEV_PROMPT_VERSION = "jev1"
BEAM_WIDTH = 3
MAX_OPTIONS = 255  # Jev's limit per Choice question
NONE = "none"
EPSILON = 1e-9
_DEFAULT = object()

INSTRUCTIONS = "Which HS {level} covers the goods on this invoice line?"
NONE_CRITERION = "None of these options covers these goods"


@dataclass
class _Path:
    """One beam candidate: the codes chosen so far and the probability of each real decision."""

    codes: list[str] = field(default_factory=list)
    probs: list[float] = field(default_factory=list)  # forced single-child steps not included
    steps: list[Step] = field(default_factory=list)

    @property
    def score(self) -> float:
        if not self.probs:
            return 1.0
        return math.exp(sum(math.log(max(p, EPSILON)) for p in self.probs) / len(self.probs))


class JevProposer:
    """Proposer (see proposers.Proposer) that walks the HS tree with Jev and beam search."""

    def __init__(
        self,
        jev: Any,
        chat: Any = None,
        nomenclature: Nomenclature | None = None,
        beam_width: int = BEAM_WIDTH,
        cache_dir: Path | None | object = _DEFAULT,
    ):
        self.jev = jev
        self.chat = chat  # reads the line in plain words first; None = placeholder gate only
        self.nomenclature = nomenclature or default_nomenclature()
        self.beam_width = beam_width
        root = default_cache_dir() if cache_dir is _DEFAULT else cache_dir
        # Interpretations share the chat classifier's cache, so its committed readings are reused.
        self._interpret_dir = root / CACHE_SUBDIR if isinstance(root, Path) else None
        self._jev_dir = root / JEV_CACHE_SUBDIR if isinstance(root, Path) else None
        self.traces: dict[str, Trace] = {}

    # ---- public ---------------------------------------------------------------------------

    def propose(self, description: str) -> list[HS6Candidate]:
        trace = Trace()
        self.traces[description] = trace

        goods = ""
        if self.chat is not None:
            chat_model = getattr(self.chat, "model", "")
            path = cache_path(
                self._interpret_dir,
                chat_model,
                PROMPT_VERSION,
                self.nomenclature.source,
                "__interpret__",
                description,
            )
            try:
                goods, vague = interpret(self.chat, chat_model, description, path)
            except ProposerError as exc:  # Jev can still decide from the raw text
                log.warning("interpret step failed, classifying raw text: %s", exc)
                goods, vague = "", False
            trace.read_as = goods
            if vague:
                trace.stopped = "too vague to identify the goods"
                return []

        beam = [_Path()]
        for _ in range(3):
            beam = self._expand(description, goods, beam, trace)
            if not beam:
                return []

        best = beam[0]
        trace.steps = best.steps
        return [HS6Candidate(hs6=p.codes[-1], score=round(p.score, 4)) for p in beam]

    def explain(self, description: str) -> str:
        """Human-readable path for the last classification of `description` ('' if none)."""
        trace = self.traces.get(description)
        return trace.summary() if trace else ""

    # ---- beam ---------------------------------------------------------------------------------

    def _expand(self, description: str, goods: str, beam: list[_Path], trace: Trace) -> list[_Path]:
        """Extend every path by one level; keep the best `beam_width` by geometric mean."""
        jobs = []
        for path in beam:
            parent = path.codes[-1] if path.codes else None
            jobs.append((path, parent, self.nomenclature.children(parent)))

        def decide(job):
            path, parent, options = job
            if len(options) < 2:
                return None  # zero options: dead end; one option: forced, no call needed
            state = self._state(description, goods, path.codes)
            return self._choose(state, parent, options)

        with ThreadPoolExecutor(max_workers=max(1, len(jobs))) as pool:
            answers = list(pool.map(decide, jobs))

        extended: list[_Path] = []
        level = "level"
        for (path, _parent, options), answer in zip(jobs, answers, strict=True):
            if not options:
                continue
            level = LEVEL_NAMES[len(options[0][0])]
            if answer is None:  # single child
                code, desc = options[0]
                step = Step(level, code, desc, 1.0, "only option")
                extended.append(_Path([*path.codes, code], path.probs, [*path.steps, step]))
                continue
            probs, confidence = answer
            ranked = sorted(
                ((c, p) for c, p in probs.items() if c != NONE and p > 0), key=lambda cp: -cp[1]
            )
            for code, p in ranked:
                alts = [(c, q) for c, q in ranked[:3] if c != code]
                reason = f"Jev p={p:.2f}, confidence {confidence:.2f}"
                if probs.get(NONE):
                    reason += f", none {probs[NONE]:.2f}"
                step = Step(level, code, self.nomenclature.describe(code), p, reason, alts)
                extended.append(_Path([*path.codes, code], [*path.probs, p], [*path.steps, step]))

        if not extended:
            trace.stopped = f"Jev: no {level} fits these goods"
            return []
        extended.sort(key=lambda p: -p.score)
        return extended[: self.beam_width]

    def _state(self, description: str, goods: str, codes: list[str]) -> dict[str, str]:
        state = {"invoice_line": description}
        if goods:
            state["what_it_is"] = goods
        if codes:
            state["classified_so_far"] = " > ".join(
                f"{LEVEL_NAMES[len(c)]} {c}: {_short(self.nomenclature.describe(c), 120)}"
                for c in codes
            )
        return state

    # ---- one Jev question -------------------------------------------------------------------

    def _choose(
        self, state: dict[str, str], parent: str | None, options: list[tuple[str, str]]
    ) -> tuple[dict[str, float], float]:
        """(probability per option code and "none", confidence) for one Choice question."""
        if len(options) + 1 > MAX_OPTIONS:
            raise ProposerError(f"{len(options)} options under {parent}: over Jev's limit")
        key = json.dumps(state, sort_keys=True)
        path = cache_path(
            self._jev_dir,
            self.jev.model,
            JEV_PROMPT_VERSION,
            self.nomenclature.source,
            parent,
            key,
        )
        if path is not None and path.exists():
            data = json.loads(path.read_text())
            return data["probabilities"], data["confidence"]

        level = LEVEL_NAMES[len(options[0][0])]
        criteria: dict[str, str] = {code: desc or code for code, desc in options}
        criteria[NONE] = NONE_CRITERION
        question = {
            "type": "choice",
            "instructions": INSTRUCTIONS.format(level=level),
            "criteria": criteria,
        }
        try:
            answer = self.jev.decide(state, {"hs": question})["hs"]
        except LLMError as exc:
            raise ProposerError(str(exc)) from exc
        raw = answer.get("probabilities") or {}
        probs = {c: float(p) for c, p in raw.items() if c in criteria}
        if not probs:
            raise ProposerError(f"Jev gave no probabilities for the {level} options")
        confidence = float(answer.get("confidence") or 0.0)

        if path is not None:
            payload = {
                "state": state,
                "parent": parent,
                "probabilities": probs,
                "confidence": confidence,
            }
            try:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(payload, indent=2) + "\n")
            except OSError:
                pass  # a read-only disk must not break classification
        return probs, confidence


__all__ = ["JevProposer"]
