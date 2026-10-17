"""P3: red-flag rules R1-R8 (plan.md Phase 4). One file per rule, thresholds in rules/config.yaml."""

from __future__ import annotations

from tbml.rules import (
    arithmetic_error,
    geo_inconsistent,
    low_confidence,
    placeholder_desc,
    price_outlier,
    qty_value_implausible,
    residential_consignee,
    route_no_economic_sense,
)
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Severity

# R1..R8 in plan order; this order breaks ties when sorting flags.
RULES = (
    price_outlier,
    qty_value_implausible,
    placeholder_desc,
    geo_inconsistent,
    route_no_economic_sense,
    arithmetic_error,
    residential_consignee,
    low_confidence,
)

_SEVERITY_RANK = {Severity.high: 0, Severity.medium: 1, Severity.low: 2}


def sort_flags(flags: list[Flag]) -> list[Flag]:
    """Highest severity first (plan 4.5); stable, so rule order then line order is kept within a severity."""
    return sorted(flags, key=lambda f: _SEVERITY_RANK[f.severity])


def run_rules_with_warnings(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
) -> tuple[list[Flag], list[str]]:
    """Run every rule. Returns the sorted flags and the warnings rules raised (e.g. a skipped check)."""
    warnings: list[str] = []
    flags: list[Flag] = []
    for rule in RULES:
        flags.extend(rule.check(invoice, enriched, benchmarks, warnings))
    return sort_flags(flags), warnings


def run_rules(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
) -> list[Flag]:
    return run_rules_with_warnings(invoice, enriched, benchmarks)[0]


__all__ = ["RULES", "run_rules", "run_rules_with_warnings", "sort_flags"]
