"""P3: combine flags into a priority score and band (plan.md 4.4)."""

from __future__ import annotations

from tbml.rules._common import config
from tbml.schemas import Flag, PriorityBand


def score(flags: list[Flag]) -> tuple[float, PriorityBand]:
    """Weighted sum of flag severities, capped; weights, cap and band edges come from rules/config.yaml."""
    cfg = config("scoring")
    total = sum(cfg["weights"][f.severity.value] for f in flags)
    points = float(min(total, cfg["cap"]))
    if points >= cfg["review_now_min"]:
        band = PriorityBand.review_now
    elif points >= cfg["review_min"]:
        band = PriorityBand.review
    else:
        band = PriorityBand.low
    return points, band


__all__ = ["score"]
