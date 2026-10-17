"""R8 LOW_CONFIDENCE: lines the system was unsure about, so an officer should read them by hand."""

from __future__ import annotations

from tbml.rules._common import config, make_flag
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    """Flag lines whose extraction or classification confidence is below `min_confidence`.

    Always low severity: it asks an officer to read the line, it does not say anything is wrong."""
    floor = config("low_confidence")["min_confidence"]
    by_id = {e.line_id: e for e in enriched}
    flags: list[Flag] = []
    for item in invoice.line_items:
        e = by_id.get(item.line_id)
        extraction = item.extraction_confidence
        classification = e.classification_confidence if e is not None else None
        weak = []
        if extraction < floor:
            weak.append(f"reading the text of the line ({extraction:.0%} sure)")
        if classification is not None and classification < floor:
            weak.append(f"identifying the product ({classification:.0%} sure)")
        if not weak:
            continue
        reason = (
            f"The system was not confident about line {item.line_id}: {' and '.join(weak)}. "
            f"Please check this line manually before relying on the other results for it."
        )
        flags.append(
            make_flag(
                Rule.LOW_CONFIDENCE,
                item.line_id,
                Severity.low,
                reason,
                {
                    "extraction_confidence": extraction,
                    "classification_confidence": classification,
                    "min_confidence": floor,
                },
            )
        )
    return flags
