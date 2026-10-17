"""P2: line item -> HS6 + normalised quantity. Phase 0 stub: one fixture-shaped line per item."""

from tbml.fixtures import load_fixture
from tbml.schemas import EnrichedLine, Invoice


def enrich(invoice: Invoice) -> list[EnrichedLine]:
    template = EnrichedLine.model_validate(load_fixture("enriched_line"))
    return [template.model_copy(update={"line_id": item.line_id}) for item in invoice.line_items]


__all__ = ["enrich"]
