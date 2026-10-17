"""P2: price bands from cache. Phase 0 stub: the fixture band when the HS6 matches."""

from tbml.fixtures import load_fixture
from tbml.schemas import Benchmark, EnrichedLine


def benchmark(enriched_line: EnrichedLine) -> Benchmark | None:
    band = Benchmark.model_validate(load_fixture("benchmark"))
    return band if enriched_line.hs6 == band.hs6 else None


__all__ = ["benchmark"]
