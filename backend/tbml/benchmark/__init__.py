"""P2: price bands for an enriched line, read from the cached band table (plan.md §3.3).

`bands.parquet` (real, from `fetch_benchmarks.py`) is used when present, else `bands_mock.parquet`
with `is_mock = True`. A route-specific row wins over the global row for the same HS6.
"""

from __future__ import annotations

from functools import lru_cache

import pandas as pd

from tbml.paths import BENCHMARKS_DIR
from tbml.schemas import Benchmark, EnrichedLine


@lru_cache(maxsize=1)
def _bands() -> dict[tuple[str, str | None], Benchmark]:
    path = BENCHMARKS_DIR / "bands.parquet"
    if not path.exists():
        path = BENCHMARKS_DIR / "bands_mock.parquet"
    out: dict[tuple[str, str | None], Benchmark] = {}
    for row in pd.read_parquet(path).to_dict("records"):
        row["route"] = row["route"] if isinstance(row["route"], str) else None
        row["years"] = [int(y) for y in row["years"]]
        row["sources"] = [str(s) for s in row["sources"]]
        b = Benchmark.model_validate(row)
        out[(b.hs6, b.route)] = b
    return out


def benchmarks_are_mock() -> bool:
    """True when the band table in use is the mock one (the UI shows a badge)."""
    return any(b.is_mock for b in _bands().values())


def benchmark(enriched_line: EnrichedLine, route: str | None = None) -> Benchmark | None:
    """Band for the line's HS6 on `route` ("GB-AE" style) if there is one, else the global band."""
    if enriched_line.hs6 is None:
        return None
    bands = _bands()
    return bands.get((enriched_line.hs6, route)) or bands.get((enriched_line.hs6, None))


__all__ = ["benchmark", "benchmarks_are_mock"]
