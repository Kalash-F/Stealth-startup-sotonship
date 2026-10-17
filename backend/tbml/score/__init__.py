"""P3: combine flags -> priority. Phase 0 stub: the report fixture's score and band."""

from tbml.fixtures import load_fixture
from tbml.schemas import Flag, PriorityBand


def score(flags: list[Flag]) -> tuple[float, PriorityBand]:
    report = load_fixture("report")
    return float(report["priority_score"]), PriorityBand(report["priority_band"])


__all__ = ["score"]
