"""R1 PRICE_OUTLIER: the stated unit price against the benchmark band, on a log scale."""

from __future__ import annotations

import math

from tbml.rules._common import (
    config,
    fmt_money,
    fmt_ratio,
    make_flag,
    mock_note,
    paired,
    product_name,
    unit_label,
)
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    cfg = config("price_outlier")
    flags: list[Flag] = []
    for item, e, b in paired(invoice, enriched, benchmarks):
        price = e.unit_price_usd
        if b is None or price is None or price <= 0 or b.median <= 0 or b.p10 <= 0:
            if warnings is not None:
                warnings.append(
                    f"line {item.line_id}: no price benchmark or usable price, so the price check was skipped"
                )
            continue
        log_dev = math.log(price / b.median)
        spread = math.log(b.p90 / b.p10)
        if b.p10 <= price <= b.p90:
            continue
        high = abs(log_dev) > cfg["high_spread_multiple"] * spread
        over = price > b.median
        ratio = price / b.median if over else b.median / price
        unit = unit_label(b.unit)
        what = product_name(item, e)
        band = f"{fmt_money(b.p10)} to {fmt_money(b.p90)} per {unit}"
        if over:
            reason = (
                f"Over-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
                f"{fmt_ratio(ratio)} times the typical price of {fmt_money(b.median)} per {unit}, "
                f"{'far outside' if high else 'above'} the normal range of {band}."
            )
        else:
            reason = (
                f"Under-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
                f"{fmt_ratio(ratio)} times lower than the typical price of {fmt_money(b.median)} per {unit}, "
                f"{'far outside' if high else 'below'} the normal range of {band}."
            )
        flags.append(
            make_flag(
                Rule.PRICE_OUTLIER,
                item.line_id,
                Severity.high if high else Severity.medium,
                reason + mock_note(b),
                {
                    "unit_price_usd": price,
                    "median": b.median,
                    "p10": b.p10,
                    "p90": b.p90,
                    "log_dev": round(log_dev, 2),
                    "spread": round(spread, 2),
                    "direction": "over" if over else "under",
                    "benchmark_unit": unit,
                    "benchmark_route": b.route,
                    "benchmark_sources": b.sources,
                    "benchmark_is_mock": b.is_mock,
                },
                expected=band,
                stated=f"{fmt_money(price)} per {unit}",
                variance_pct=(price / b.median - 1) * 100,
            )
        )
    return flags
