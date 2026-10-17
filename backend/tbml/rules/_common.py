"""Shared helpers for the rule files: config, flag construction, number formatting, pairing."""

from __future__ import annotations

import csv
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from tbml.paths import REFERENCE_DIR
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, LineItem, Rule, Severity

CONFIG_PATH = Path(__file__).with_name("config.yaml")

RULE_CODES: dict[Rule, str] = {
    Rule.PRICE_OUTLIER: "R1",
    Rule.QTY_VALUE_IMPLAUSIBLE: "R2",
    Rule.PLACEHOLDER_DESC: "R3",
    Rule.GEO_INCONSISTENT: "R4",
    Rule.ROUTE_NO_ECONOMIC_SENSE: "R5",
    Rule.ARITHMETIC_ERROR: "R6",
    Rule.RESIDENTIAL_CONSIGNEE: "R7",
    Rule.LOW_CONFIDENCE: "R8",
}


@lru_cache(maxsize=1)
def _config() -> dict[str, Any]:
    return yaml.safe_load(CONFIG_PATH.read_text())


def config(section: str) -> dict[str, Any]:
    """One section of rules/config.yaml (see that file for what each key means)."""
    return _config()[section]


@lru_cache(maxsize=1)
def fx_units_per_usd() -> dict[str, float]:
    """Currency -> units per 1 USD, from data/reference/fx.csv (approximate, see DECISIONS D1.3)."""
    with open(REFERENCE_DIR / "fx.csv", newline="") as f:
        return {row["currency"]: float(row["units_per_usd"]) for row in csv.DictReader(f)}


def make_flag(
    rule: Rule,
    line_id: str | None,
    severity: Severity,
    reason: str,
    evidence: dict[str, Any],
    *,
    expected: str | None = None,
    stated: str | None = None,
    variance_pct: float | None = None,
    suffix: str = "",
) -> Flag:
    flag_id = f"{RULE_CODES[rule]}-{line_id or 'INV'}{suffix}"
    return Flag(
        flag_id=flag_id,
        rule=rule,
        line_id=line_id,
        severity=severity,
        expected=expected,
        stated=stated,
        variance_pct=None if variance_pct is None else round(variance_pct, 1),
        reason=reason,
        evidence=evidence,
    )


def paired(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
) -> Iterator[tuple[LineItem, EnrichedLine, Benchmark | None]]:
    """Each invoice line with its enrichment and band, matched on line_id (lines without one are skipped)."""
    by_id = {e.line_id: (e, b) for e, b in zip(enriched, benchmarks, strict=True)}
    for item in invoice.line_items:
        if item.line_id in by_id:
            e, b = by_id[item.line_id]
            yield item, e, b


def fmt_num(x: float) -> str:
    """Quantity-style number: thousands separators, no trailing zeros."""
    return f"{x:,.2f}".rstrip("0").rstrip(".")


def fmt_money(x: float, symbol: str = "$") -> str:
    """Money with precision that suits the size: cents for large sums, more digits for tiny prices."""
    ax = abs(x)
    if ax >= 1:
        return f"{symbol}{x:,.2f}"
    if ax >= 0.01:
        return f"{symbol}{x:,.4f}"
    return f"{symbol}{x:,.6f}"


def unit_label(unit: str) -> str:
    """Benchmark unit in words a non-specialist reads easily ('u' means one item)."""
    return {"u": "item", "l": "litre"}.get(unit, unit)


def fmt_ratio(r: float) -> str:
    """'about N times' wording helper: whole numbers from 10 up, one decimal below."""
    return f"{r:,.0f}" if r >= 10 else f"{r:,.1f}"


def product_name(item: LineItem, e: EnrichedLine) -> str:
    return (e.hs6_description or item.description).strip()


def mock_note(b: Benchmark) -> str:
    return (
        " Note: the comparison prices are mock data, not real trade statistics."
        if b.is_mock
        else ""
    )
