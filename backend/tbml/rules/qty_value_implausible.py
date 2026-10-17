"""R2 QTY_VALUE_IMPLAUSIBLE: a line worth far more than its quantity could be, or an invoice too big for its line count."""

from __future__ import annotations

from tbml.rules._common import (
    config,
    fmt_money,
    fmt_num,
    make_flag,
    mock_note,
    paired,
    product_name,
)
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    cfg = config("qty_value_implausible")
    flags: list[Flag] = []
    total_usd = 0.0
    for item, e, b in paired(invoice, enriched, benchmarks):
        qty, price = e.normalised_quantity, e.unit_price_usd
        if qty is None or price is None or qty <= 0:
            continue
        value = price * qty
        total_usd += value
        if b is None:
            continue
        ceiling = b.p90 * qty * cfg["ceiling_p90_multiple"]
        if value <= ceiling:
            continue
        over_by = value / ceiling
        high = over_by >= cfg["high_ceiling_multiple"]
        what = product_name(item, e)
        reason = (
            f"Line {item.line_id} declares {fmt_num(item.quantity)} {item.unit} of {what} with a value of about "
            f"{fmt_money(value)}. Even at {cfg['ceiling_p90_multiple']:g} times the top of the normal price range, that quantity would be "
            f"worth no more than about {fmt_money(ceiling)}, so the value is out of proportion to the quantity."
        )
        flags.append(
            make_flag(
                Rule.QTY_VALUE_IMPLAUSIBLE,
                item.line_id,
                Severity.high if high else Severity.medium,
                reason + mock_note(b),
                {
                    "line_value_usd": round(value, 2),
                    "ceiling_usd": round(ceiling, 2),
                    "normalised_quantity": qty,
                    "benchmark_unit": b.unit,
                    "p90": b.p90,
                    "ceiling_p90_multiple": cfg["ceiling_p90_multiple"],
                    "printed_quantity": item.quantity,
                    "printed_unit": item.unit,
                    "benchmark_is_mock": b.is_mock,
                },
                expected=f"at most about {fmt_money(ceiling)}",
                stated=fmt_money(value),
                variance_pct=(over_by - 1) * 100,
            )
        )
    if not flags and invoice.line_items and total_usd > 0:
        average = total_usd / len(invoice.line_items)
        if average > cfg["max_avg_line_value_usd"]:
            n = len(invoice.line_items)
            reason = (
                f"The invoice is worth about {fmt_money(total_usd)} across only {n} line{'s' if n != 1 else ''}, "
                f"an average of {fmt_money(average)} per line, which is unusually large for so few items."
            )
            flags.append(
                make_flag(
                    Rule.QTY_VALUE_IMPLAUSIBLE,
                    None,
                    Severity.medium,
                    reason,
                    {
                        "invoice_value_usd": round(total_usd, 2),
                        "line_count": n,
                        "average_line_value_usd": round(average, 2),
                        "max_average_line_value_usd": cfg["max_avg_line_value_usd"],
                    },
                    expected=f"at most {fmt_money(cfg['max_avg_line_value_usd'])} per line on average",
                    stated=f"{fmt_money(average)} per line on average",
                )
            )
    return flags
