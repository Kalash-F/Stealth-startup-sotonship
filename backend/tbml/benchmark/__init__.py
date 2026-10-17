"""P2: price bands for an enriched line, read from the cached band table (plan.md §3.3).

`bands.json` (real, from `fetch_benchmarks.py`) is used when present, else `bands_mock.json`
with `is_mock = True`. A route-specific row wins over the global row for the same HS6.
"""

from __future__ import annotations

import json
from functools import lru_cache

from tbml.paths import BENCHMARKS_DIR
from tbml.schemas import Benchmark, EnrichedLine


@lru_cache(maxsize=1)
def band_table() -> tuple[Benchmark, ...]:
    """Every row of the band table in use: `bands.json` when present, else `bands_mock.json`."""
    path = BENCHMARKS_DIR / "bands.json"
    if not path.exists():
        path = BENCHMARKS_DIR / "bands_mock.json"
    return tuple(Benchmark.model_validate(row) for row in json.loads(path.read_text()))


@lru_cache(maxsize=1)
def _bands() -> dict[tuple[str, str | None], Benchmark]:
    return {(b.hs6, b.route): b for b in band_table()}


def benchmarks_are_mock() -> bool:
    """True when the band table in use is the mock one (the UI shows a badge)."""
    return any(b.is_mock for b in band_table())


def benchmark(enriched_line: EnrichedLine, route: str | None = None) -> Benchmark | None:
    """Band for the line's HS6 on `route` ("GB-AE" style) if there is one, else the global band."""
    if enriched_line.hs6 is None:
        return None
    bands = _bands()
    return bands.get((enriched_line.hs6, route)) or bands.get((enriched_line.hs6, None))


__all__ = ["band_table", "benchmark", "benchmarks_are_mock"]
