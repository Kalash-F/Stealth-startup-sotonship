"""R7 RESIDENTIAL_CONSIGNEE: a large shipment going to a private residence."""

from __future__ import annotations

from tbml.rules._common import config, fmt_money, fx_units_per_usd, make_flag
from tbml.schemas import AddressType, Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def invoice_total_usd(invoice: Invoice, enriched: list[EnrichedLine]) -> float | None:
    """The stated total in USD: via the FX table, else from the enriched lines' USD values."""
    rate = fx_units_per_usd().get(invoice.currency)
    if rate:
        return invoice.stated_total / rate
    values = [
        e.unit_price_usd * e.normalised_quantity
        for e in enriched
        if e.unit_price_usd is not None and e.normalised_quantity is not None
    ]
    return sum(values) if values else None


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    cfg = config("residential_consignee")
    receiver, role = (invoice.consignee, "consignee"), (invoice.buyer, "buyer")
    party, label = next(
        (
            (p, r)
            for p, r in (receiver, role)
            if p is not None and p.address_type == AddressType.residential
        ),
        (None, None),
    )
    if party is None:
        return []
    total = invoice_total_usd(invoice, enriched)
    if total is None:
        if warnings is not None:
            warnings.append(
                "invoice total in USD could not be worked out, so the residential-address check was skipped"
            )
        return []
    if total <= cfg["min_total_usd"]:
        return []
    high = label == "consignee" and total > cfg["high_total_usd"]
    reason = (
        f"The {label}, {party.name}, appears to be a private home ({party.address}), but the invoice is worth "
        f"about {fmt_money(total)}. Goods of this value are normally delivered to a business address."
    )
    return [
        make_flag(
            Rule.RESIDENTIAL_CONSIGNEE,
            None,
            Severity.high if high else Severity.medium,
            reason,
            {
                "party_role": label,
                "party_name": party.name,
                "party_address": party.address,
                "address_type": party.address_type.value,
                "invoice_total_usd": round(total, 2),
                "min_total_usd": cfg["min_total_usd"],
                "high_total_usd": cfg["high_total_usd"],
            },
            expected=f"business address for shipments above {fmt_money(cfg['min_total_usd'])}",
            stated=f"{label} at a residential address, {fmt_money(total)}",
        )
    ]
