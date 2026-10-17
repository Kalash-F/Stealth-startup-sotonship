"""Description -> HS6 (plan 3.7, 3.8)."""

from __future__ import annotations

from dataclasses import dataclass, field

from tbml.classify.hs6 import HS6Entry, default_hs6
from tbml.classify.placeholder import PLACEHOLDER_REASON, is_placeholder
from tbml.classify.proposers import Proposer, ProposerError
from tbml.schemas import HS6Candidate

MIN_SCORE = 0.5
PLACEHOLDER_CONFIDENCE = 0.05


@dataclass
class Classification:
    hs6: str | None
    description: str | None
    candidates: list[HS6Candidate] = field(default_factory=list)
    confidence: float = 0.0
    reason: str = ""


def classify_description(
    description: str, proposer: Proposer, entries: dict[str, HS6Entry] | None = None
) -> Classification:
    entries = entries if entries is not None else default_hs6()
    if is_placeholder(description):
        return Classification(None, None, [], PLACEHOLDER_CONFIDENCE, PLACEHOLDER_REASON)
    try:
        proposed = proposer.propose(description)
    except ProposerError as exc:
        return Classification(None, None, [], 0.0, f"classifier unavailable: {exc}")

    seen: set[str] = set()
    valid: list[HS6Candidate] = []
    for cand in sorted(proposed, key=lambda c: -c.score):
        if cand.hs6 in entries and cand.hs6 not in seen:
            seen.add(cand.hs6)
            valid.append(cand)
    valid = valid[:3]
    if not valid:
        return Classification(None, None, [], 0.0, "no proposed code exists in the HS6 list")
    top = valid[0]
    if top.score < MIN_SCORE:
        reason = f"best candidate {top.hs6} scored {top.score:.2f}, below {MIN_SCORE}"
        return Classification(None, None, valid, top.score, reason)
    return Classification(top.hs6, entries[top.hs6].description, valid, top.score, "")
