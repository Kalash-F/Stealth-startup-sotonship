"""R6 ARITHMETIC_ERROR: quantity x price against the line total, and the lines against the stated total."""

from __future__ import annotations

from tbml.rules._common import config, fmt_money, fmt_num, make_flag
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def _off(expected: float, stated: float, cfg: dict) -> tuple[bool, float]:
    """(outside tolerance?, difference as a percent of the expected figure)."""
    tolerance = max(cfg["tolerance_pct"] / 100 * abs(expected), cfg["tolerance_abs"])
    difference = abs(stated - expected)
    pct = difference / abs(expected) * 100 if expected else 0.0
    return round(difference, 6) > round(tolerance, 6), pct


def _severity(pct: float, cfg: dict) -> Severity:
    return Severity.high if pct >= cfg["high_variance_pct"] else Severity.medium


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    cfg = config("arithmetic_error")
    cur = invoice.currency
    flags: list[Flag] = []
    for item in invoice.line_items:
        expected = item.quantity * item.unit_price
        bad, pct = _off(expected, item.line_total, cfg)
        if not bad:
            continue
        direction = "higher" if item.line_total > expected else "lower"
        reason = (
            f"Line {item.line_id} does not add up: {fmt_num(item.quantity)} x {fmt_money(item.unit_price, '')} {cur}"
            f" should come to {fmt_money(expected, '')} {cur}, but the invoice shows "
            f"{fmt_money(item.line_total, '')} {cur}, which is {pct:.1f}% {direction}."
        )
        flags.append(
            make_flag(
                Rule.ARITHMETIC_ERROR,
                item.line_id,
                _severity(pct, cfg),
                reason,
                {
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "computed_total": round(expected, 2),
                    "stated_line_total": item.line_total,
                    "currency": cur,
                    "tolerance_pct": cfg["tolerance_pct"],
                    "tolerance_abs": cfg["tolerance_abs"],
                },
                expected=f"{fmt_money(expected, '')} {cur}",
                stated=f"{fmt_money(item.line_total, '')} {cur}",
                variance_pct=(item.line_total / expected - 1) * 100 if expected else None,
            )
        )
    lines_sum = sum(item.line_total for item in invoice.line_items)
    bad, pct = _off(lines_sum, invoice.stated_total, cfg)
    if bad:
        direction = "higher" if invoice.stated_total > lines_sum else "lower"
        reason = (
            f"The invoice total does not match its lines: the lines add up to {fmt_money(lines_sum, '')} {cur}, "
            f"but the stated total is {fmt_money(invoice.stated_total, '')} {cur}, which is {pct:.1f}% {direction}."
        )
        flags.append(
            make_flag(
                Rule.ARITHMETIC_ERROR,
                None,
                _severity(pct, cfg),
                reason,
                {
                    "sum_of_lines": round(lines_sum, 2),
                    "stated_total": invoice.stated_total,
                    "currency": cur,
                    "tolerance_pct": cfg["tolerance_pct"],
                    "tolerance_abs": cfg["tolerance_abs"],
                },
                expected=f"{fmt_money(lines_sum, '')} {cur}",
                stated=f"{fmt_money(invoice.stated_total, '')} {cur}",
                variance_pct=(invoice.stated_total / lines_sum - 1) * 100 if lines_sum else None,
            )
        )
    return flags
