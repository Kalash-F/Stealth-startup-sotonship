"""P2: line item -> HS6 + normalised quantity and USD price per benchmark unit."""

from tbml.classify.classifier import Classification, classify_description
from tbml.classify.hierarchical import HierarchicalProposer
from tbml.classify.nomenclature import Nomenclature, default_nomenclature, load_nomenclature
from tbml.classify.normalise import Normalised, normalise
from tbml.classify.proposers import (
    AnthropicProposer,
    CachedProposer,
    KeywordProposer,
    Proposer,
    ProposerError,
    default_proposer,
)
from tbml.schemas import EnrichedLine, Invoice


def enrich(invoice: Invoice, proposer: Proposer | None = None) -> list[EnrichedLine]:
    """Classify and normalise every line: one EnrichedLine per invoice line, same order.

    An unclassified line keeps `hs6=None` and gets a note saying why; its quantity and price are
    left unnormalised, so the price rules skip it instead of guessing.
    """
    proposer = proposer or default_proposer()
    lines: list[EnrichedLine] = []
    for item in invoice.line_items:
        cls = classify_description(item.description, proposer)
        norm = normalise(item, cls.hs6, invoice.currency)
        note = norm.note if cls.hs6 else f"not classified: {cls.reason}; {norm.note}"
        if cls.hs6 and cls.path:
            note = f"HS path: {cls.path}; {note}"
        lines.append(
            EnrichedLine(
                line_id=item.line_id,
                hs6=cls.hs6,
                hs6_description=cls.description,
                hs6_candidates=cls.candidates,
                classification_confidence=cls.confidence,
                normalised_quantity=norm.quantity,
                benchmark_unit=norm.unit,
                unit_price_usd=norm.unit_price_usd,
                normalisation_note=note,
            )
        )
    return lines


__all__ = [
    "AnthropicProposer",
    "CachedProposer",
    "Classification",
    "HierarchicalProposer",
    "Nomenclature",
    "KeywordProposer",
    "Normalised",
    "Proposer",
    "ProposerError",
    "classify_description",
    "default_nomenclature",
    "default_proposer",
    "enrich",
    "load_nomenclature",
    "normalise",
]
