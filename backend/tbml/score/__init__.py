"""P3: combine flags into a priority score and band (plan.md 4.4)."""

from __future__ import annotations

from tbml.rules._common import config
from tbml.schemas import Flag, PriorityBand


def _factor(flag: Flag) -> float:
    factor = flag.evidence.get("score_factor", 1.0)
    return float(factor) if isinstance(factor, int | float) and factor > 0 else 1.0


def score(flags: list[Flag]) -> tuple[float, PriorityBand]:
    """Weighted sum of flag severities, capped; weights, cap and band edges come from rules/config.yaml.

    A flag can scale its own weight with `evidence["score_factor"]` (R1 does, from how many years
    of trade data agree that the price is out of line), so the same severity can count for more or
    less."""
    cfg = config("scoring")
    total = sum(cfg["weights"][f.severity.value] * _factor(f) for f in flags)
    points = round(float(min(total, cfg["cap"])), 1)
    if points >= cfg["review_now_min"]:
        band = PriorityBand.review_now
    elif points >= cfg["review_min"]:
        band = PriorityBand.review
    else:
        band = PriorityBand.low
    return points, band


__all__ = ["score"]
