"""P2: price bands for an enriched line (plan.md §3.3).

Two sources, tried in this order:

1. The sharded HMRC benchmark databases (`data/databases/db_*.db`, see `shards.py`): UK imports
   of every commodity code, 2023 to the latest month, with p1 to p99 per year and for all years
   pooled. The line's HS6 is looked up with origin "ALL" (every origin pooled: the judge) and at
   least `MIN_PRICES` prices, falling back to its HS4 heading (same unit) when the HS6 is too
   thin. The band carries the whole series (each year plus all years) so the price rule can say
   how consistently the price is out of line, the origin country's own band as context, and the
   band on the other basis (per kg / per unit).
2. The JSON band table (`bands.json` from `fetch_benchmarks.py`, else `bands_mock.json` with
   `is_mock = True`) for HS6 codes the databases do not cover, or when they are absent. A
   route-specific row wins over the global row for the same HS6.

`TBML_BENCHMARKS=bands` turns the databases off (e.g. to compare against the old bands).
Database prices are GBP; they are converted to USD at the Federal Reserve G.5A annual average
for the period's year (the latest year for 2026 and for all years pooled).
"""

from __future__ import annotations

import csv
import json
import os
from functools import lru_cache

from tbml.benchmark import shards
from tbml.paths import BENCHMARKS_DIR, REFERENCE_DIR
from tbml.schemas import Benchmark, EnrichedLine, PriceBand

# A band needs at least this many prices to judge an invoice (the databases' own `min_prices`).
MIN_PRICES = 30
DB_SOURCE = "HMRC OTS UK imports (benchmark database)"

# HMRC supplementary unit -> the normaliser's benchmark unit (tbml/classify/normalise.py).
# Other supplementary units (m2, m3, carats, ...) cannot be derived from an invoice line yet, so
# those goods are priced per kg.
HMRC_UNITS = {"NO": "u", "LTR": "l", "PR": "pr"}
_TO_HMRC = {v: k for k, v in HMRC_UNITS.items()}
_LEVEL_ORDER = {"cn8": 0, "hs6": 1, "hs4": 2}


def band_file() -> str:
    """Name of the band file in use (shown on /health so a deploy can be checked)."""
    return "bands.json" if (BENCHMARKS_DIR / "bands.json").exists() else "bands_mock.json"


@lru_cache(maxsize=1)
def band_table() -> tuple[Benchmark, ...]:
    """Every row of the band table in use: `bands.json` when present, else `bands_mock.json`."""
    path = BENCHMARKS_DIR / band_file()
    return tuple(Benchmark.model_validate(row) for row in json.loads(path.read_text()))


@lru_cache(maxsize=1)
def _bands() -> dict[tuple[str, str | None], Benchmark]:
    return {(b.hs6, b.route): b for b in band_table()}


def database_enabled() -> bool:
    """True when the benchmark databases are present and not switched off."""
    return os.environ.get("TBML_BENCHMARKS", "").lower() != "bands" and shards.available()


def benchmarks_are_mock() -> bool:
    """True when the band table in use is the mock one (the UI shows a badge). The databases are
    real statistics, so with them the answer is always False."""
    return not database_enabled() and any(b.is_mock for b in band_table())


def describe_source() -> str:
    """Price data in use, for /health: 'database:<n> shards' or the band file name."""
    return f"database:{shards.shard_count()} shards" if database_enabled() else band_file()


@lru_cache(maxsize=1)
def _gbp_to_usd() -> dict[str, float]:
    """Year -> USD per GBP (fx_annual.csv); 'latest' holds the most recent year's rate."""
    rates: dict[str, float] = {}
    with open(REFERENCE_DIR / "fx_annual.csv", newline="") as f:
        for row in csv.DictReader(f):
            if row["currency"] == "GBP":
                rates[row["year"]] = float(row["usd_per_unit"])
    rates["latest"] = rates[max(rates)]
    return rates


def gbp_to_usd(period: str) -> float:
    """USD per GBP for a database period ('2024', or 'all' / a year with no rate yet: latest)."""
    rates = _gbp_to_usd()
    return rates.get(period, rates["latest"])


def _unit_of(row: shards.Row) -> str:
    """Benchmark unit of a database row in the normaliser's words ('kg', 'u', 'l', 'pr'), or the
    HMRC code itself when the normaliser cannot convert to it."""
    if row["basis"] == "per_kg":
        return "kg"
    return HMRC_UNITS.get(str(row["unit"]), str(row["unit"]))


def _usable(row: shards.Row) -> bool:
    return int(row["n_prices"] or 0) >= MIN_PRICES and row["median"] is not None


def _price_band(row: shards.Row) -> PriceBand | None:
    """A database row as a PriceBand in USD; None if its percentiles are not monotonic."""
    rate = gbp_to_usd(str(row["year"]))
    pct = {
        k: float(row[k]) * rate
        for k in ("p1", "p5", "p10", "p25", "median", "p75", "p90", "p95", "p99")
    }  # type: ignore[arg-type]
    try:
        return PriceBand(
            level=str(row["level"]),
            code=str(row["code"]),
            basis=str(row["basis"]),
            unit=_unit_of(row),
            period=str(row["year"]),
            origin=str(row["origin"]),
            recommended=bool(row["recommended"]),
            n_observations=int(row["n_prices"] or 0),
            months=int(row["months"] or 0),
            median_vs_prev_year=None
            if row["median_vs_prev_year"] is None
            else float(row["median_vs_prev_year"]),  # type: ignore[arg-type]
            **pct,
        )
    except ValueError:
        return None


def _period_key(band: PriceBand) -> tuple[int, str]:
    return (1, band.period) if band.period == "all" else (0, band.period)


def _levels(code: str) -> list[tuple[str, str]]:
    """Most specific first: (level, code) pairs to try for an 8-, 6- or 4-digit code."""
    out = []
    if len(code) >= 8:
        out.append(("cn8", code[:8]))
    if len(code) >= 6:
        out.append(("hs6", code[:6]))
    out.append(("hs4", code[:4]))
    return out


def database_units(code: str) -> tuple[str, ...]:
    """Benchmark units the databases can judge `code` in, per-unit units first, then 'kg'.

    Only units the normaliser can convert an invoice line into are listed ('u', 'l', 'pr', 'kg'),
    and only when a recommended, pooled-origin band with enough prices exists at some level."""
    if not database_enabled():
        return ()
    found: list[str] = []
    for level, c in _levels(code):
        for row in shards.series(c, level):
            if row["origin"] != "ALL" or not row["recommended"] or not _usable(row):
                continue
            unit = _unit_of(row)
            if unit in ("u", "l", "pr", "kg") and unit not in found:
                found.append(unit)
    return tuple(sorted(found, key=lambda u: u == "kg"))


def benchmark_units(code: str) -> tuple[str, ...]:
    """Every benchmark unit a line with this HS6 can be priced in, best first: the databases'
    units, else the band table's single unit, else none."""
    units = database_units(code)
    if units:
        return units
    band = _bands().get((code[:6], None))
    return (band.unit,) if band else ()


def _pick(
    rows: tuple[shards.Row, ...], origin: str, basis: str, unit: str | None
) -> shards.Row | None:
    """The recommended row for (origin, basis[, HMRC unit]) with enough prices; with several units
    (per_unit at cn8 level can mix), the one with most prices."""
    cands = [
        r
        for r in rows
        if r["origin"] == origin
        and r["basis"] == basis
        and r["recommended"]
        and (unit is None or r["unit"] == unit)
        and _usable(r)
    ]
    return max(cands, key=lambda r: int(r["n_prices"] or 0), default=None)


def database_benchmark(code: str, unit: str, origin: str | None = None) -> Benchmark | None:
    """The databases' band for `code` (4, 6 or 8 digits) in benchmark unit `unit`.

    Hierarchical fallback cn8 -> hs6 -> hs4 on the recommended, pooled-origin row with at least
    MIN_PRICES prices (per-unit bands must have the same unit at every level). `origin` (ISO-2)
    adds that country's own recommended band as context when the databases hold one."""
    return _database_benchmark(code, unit, origin) if database_enabled() else None


@lru_cache(maxsize=4096)
def _database_benchmark(code: str, unit: str, origin: str | None) -> Benchmark | None:
    basis = "per_kg" if unit == "kg" else "per_unit"
    hmrc_unit = None if basis == "per_kg" else _TO_HMRC.get(unit)
    if basis == "per_unit" and hmrc_unit is None:
        return None
    for level, c in _levels(code):
        rows = shards.series(c, level)
        row = _pick(rows, "ALL", basis, hmrc_unit)
        if row is None:
            continue
        main = _price_band(row)
        if main is None:
            continue
        history = sorted(
            (
                b
                for r in rows
                if r["origin"] == "ALL" and r["basis"] == basis and r["unit"] == row["unit"]
                for b in [_price_band(r)]
                if b is not None
            ),
            key=_period_key,
        )
        origin_band = None
        if origin and origin != "ALL":
            o = _pick(rows, origin, basis, str(row["unit"]))
            origin_band = _price_band(o) if o else None
        other = _pick(rows, "ALL", "per_unit" if basis == "per_kg" else "per_kg", None)
        years = sorted({int(b.period) for b in history if b.period.isdigit()})
        return Benchmark(
            hs6=code[:6] if len(code) >= 6 else code.ljust(6, "0"),
            route=None,
            unit=unit,
            p10=main.p10,
            p25=main.p25,
            median=main.median,
            p75=main.p75,
            p90=main.p90,
            n_observations=main.n_observations,
            years=[int(main.period)] if main.period.isdigit() else years,
            sources=[
                DB_SOURCE,
                f"{main.level.upper()} {main.code}, {main.period}, GBP->USD at {gbp_to_usd(main.period):g}",
            ],
            is_mock=False,
            p1=main.p1,
            p5=main.p5,
            p95=main.p95,
            p99=main.p99,
            level=main.level,
            code=main.code,
            basis=basis,
            period=main.period,
            history=history,
            origin_band=origin_band,
            other_basis=_price_band(other) if other else None,
        )
    return None


def benchmark(
    enriched_line: EnrichedLine, route: str | None = None, origin: str | None = None
) -> Benchmark | None:
    """Band for the line: the databases' band in the line's benchmark unit when there is one,
    else the band table's row for its HS6 on `route` ("GB-AE" style), else its global row.
    `origin` (ISO-2) is the goods' origin country, used for context in database bands."""
    if enriched_line.hs6 is None:
        return None
    units = (
        (enriched_line.benchmark_unit,)
        if enriched_line.benchmark_unit
        else database_units(enriched_line.hs6)
    )
    for unit in units[:1]:
        found = database_benchmark(enriched_line.hs6, unit, origin)
        if found is not None:
            return found
    bands = _bands()
    return bands.get((enriched_line.hs6, route)) or bands.get((enriched_line.hs6, None))


__all__ = [
    "DB_SOURCE",
    "MIN_PRICES",
    "band_file",
    "band_table",
    "benchmark",
    "benchmark_units",
    "benchmarks_are_mock",
    "database_benchmark",
    "database_enabled",
    "database_units",
    "describe_source",
    "gbp_to_usd",
]
