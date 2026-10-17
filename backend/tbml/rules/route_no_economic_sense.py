"""R5 ROUTE_NO_ECONOMIC_SENSE: a high price for a good that costs about the same at both ends of
the route."""

from __future__ import annotations

from tbml.rules._common import (
    config,
    fmt_money,
    make_flag,
    mock_note,
    paired,
    product_name,
    unit_label,
)
from tbml.rules._geo import country_name
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def _medians_close(cfg: dict, hs6: str, origin: str, destination: str) -> tuple[bool, dict]:
    """Whether the good has near-identical prices at both ends, plus the evidence for that call."""
    tolerance = cfg["parity_tolerance_pct"]
    medians = (cfg.get("country_medians") or {}).get(hs6, {})
    if origin in medians and destination in medians and medians[origin] > 0:
        gap = abs(medians[destination] / medians[origin] - 1) * 100
        return gap <= tolerance, {
            "parity_basis": "country_medians",
            "origin_median": medians[origin],
            "destination_median": medians[destination],
            "median_gap_pct": round(gap, 1),
            "parity_tolerance_pct": tolerance,
        }
    return hs6 in cfg["parity_hs6"], {
        "parity_basis": "parity_hs6 list (no per-country medians available)",
        "parity_tolerance_pct": tolerance,
    }


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    """Flag lines priced above p75 on a route where the good costs about the same at both ends.

    "Same price everywhere" comes from `country_medians` when both countries are listed there,
    else from the `parity_hs6` list. Always medium severity."""
    cfg = config("route_no_economic_sense")
    origin = invoice.seller.country
    destination = (invoice.consignee or invoice.buyer).country
    flags: list[Flag] = []
    for item, e, b in paired(invoice, enriched, benchmarks):
        price = e.unit_price_usd
        if b is None or price is None or e.hs6 is None or price <= b.p75:
            continue
        close, basis = _medians_close(cfg, e.hs6, origin, destination)
        if not close:
            continue
        what = product_name(item, e)
        reason = (
            f"{what.capitalize()} sells for about the same price in {country_name(origin)} and "
            f"{country_name(destination)}, so there is little commercial reason to ship it from one to the other. "
            f"The stated price of {fmt_money(price)} per {unit_label(b.unit)} is also above the 75th percentile "
            f"({fmt_money(b.p75)} per {unit_label(b.unit)}), which makes the trade harder to explain."
        )
        flags.append(
            make_flag(
                Rule.ROUTE_NO_ECONOMIC_SENSE,
                item.line_id,
                Severity.medium,
                reason + mock_note(b),
                {
                    "unit_price_usd": price,
                    "p75": b.p75,
                    "median": b.median,
                    "benchmark_unit": b.unit,
                    "route": f"{origin}-{destination}",
                    "benchmark_is_mock": b.is_mock,
                    **basis,
                },
                expected=f"at or below {fmt_money(b.p75)} per {unit_label(b.unit)}",
                stated=f"{fmt_money(price)} per {unit_label(b.unit)}",
                variance_pct=(price / b.p75 - 1) * 100,
            )
        )
    return flags
