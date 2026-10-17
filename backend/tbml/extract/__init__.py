"""P1: PDF -> Invoice (plan.md Phase 2).

`extract(pdf)` returns an `Invoice`. `extract_document(pdf)` returns the same plus the warnings
and how it was obtained. Order of attempts: cached LLM response (keyed by file hash) -> LLM
(when ANTHROPIC_API_KEY and LLM_MODEL are set) -> deterministic layout parser -> a minimal,
valid placeholder invoice with warnings. Nothing here recomputes or repairs numbers.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from pathlib import Path

from tbml.extract import llm
from tbml.extract.address import classify_address
from tbml.extract.countries import UNKNOWN_COUNTRY
from tbml.extract.layout import LayoutError, parse_layout
from tbml.extract.numbers import appears_in, numbers_in
from tbml.extract.pdftext import RawDocument, read_pdf
from tbml.schemas import AddressType, Invoice, LineItem, Party

# Confidence assigned to a line whose numbers cannot all be found in the document text.
_UNVERIFIED_CONFIDENCE = 0.5


@dataclass
class ExtractionResult:
    invoice: Invoice
    warnings: list[str] = field(default_factory=list)
    method: str = "layout"  # llm | llm-cache | layout | minimal
    llm_calls: int = 0


def _write_raw_text(doc: RawDocument, root: Path | None) -> None:
    out = (root or llm.cache_dir()) / "raw_text"
    try:
        out.mkdir(parents=True, exist_ok=True)
        (out / f"{doc.sha256}.txt").write_text(doc.render())
    except OSError:
        pass  # debugging aid only


def _settle_party(party: Party | None) -> Party | None:
    """Keyword heuristics decide address_type when they are decisive; otherwise keep the model's."""
    if party is None:
        return None
    kind = classify_address(party.name, party.address)
    return party.model_copy(update={"address_type": kind}) if kind else party


def _finalise(invoice: Invoice, doc: RawDocument, warnings: list[str]) -> Invoice:
    """Heuristic address types, and a check that every number really is in the document."""
    found = numbers_in(doc.text)
    lines: list[LineItem] = []
    for item in invoice.line_items:
        conf = max(0.0, min(1.0, item.extraction_confidence))
        for name in ("quantity", "unit_price", "line_total"):
            value = getattr(item, name)
            if not appears_in(value, found):
                warnings.append(f"{item.line_id}: {name} {value:g} not found in document text")
                conf = min(conf, _UNVERIFIED_CONFIDENCE)
        if not item.description.strip() or not item.unit.strip():
            conf = min(conf, 0.7)
        lines.append(item.model_copy(update={"extraction_confidence": conf}))
    if not appears_in(invoice.stated_total, found):
        warnings.append(f"stated total {invoice.stated_total:g} not found in document text")
    return invoice.model_copy(
        update={
            "line_items": lines,
            "seller": _settle_party(invoice.seller),
            "buyer": _settle_party(invoice.buyer),
            "consignee": _settle_party(invoice.consignee),
            "is_synthetic": "SYNTHETIC TEST DOCUMENT" in doc.text.upper(),
            "source_file": doc.path.name,
        }
    )


def _minimal(doc: RawDocument, why: str) -> Invoice:
    unknown = Party(
        name="UNKNOWN", address="", country=UNKNOWN_COUNTRY, address_type=AddressType.unknown
    )
    return Invoice(
        invoice_id=doc.path.stem,
        invoice_date=dt.date(1970, 1, 1),
        seller=unknown,
        buyer=unknown,
        consignee=None,
        country_of_origin=None,
        port_of_loading=None,
        port_of_discharge=None,
        incoterm=None,
        currency="XXX",
        line_items=[],
        stated_total=0.0,
        source_file=doc.path.name,
        is_synthetic=False,
    )


def extract_document(
    pdf_path: str | Path,
    *,
    client: llm.LLMClient | None = None,
    use_llm: bool = True,
    cache_root: Path | None = None,
) -> ExtractionResult:
    doc = read_pdf(pdf_path)
    _write_raw_text(doc, cache_root)
    warnings: list[str] = []
    if not doc.has_text:
        warnings.append("no text layer (scanned PDF?); vision fallback is not implemented")
        return ExtractionResult(_minimal(doc, "no text"), warnings, "minimal")

    if use_llm:
        cached = llm.read_cache(doc.sha256, cache_root)
        if cached is not None:
            try:
                inv = llm.validate_payload(cached, doc.path.name)
                return ExtractionResult(_finalise(inv, doc, warnings), warnings, "llm-cache")
            except ValueError:
                warnings.append("cached LLM response no longer validates; ignored")
        client = client or llm.configured_client()
        if client is not None:
            try:
                reply = llm.structure(doc, client)
                llm.write_cache(doc.sha256, client.model, reply.payload, cache_root)
                inv = llm.validate_payload(reply.payload, doc.path.name)
                return ExtractionResult(_finalise(inv, doc, warnings), warnings, "llm", reply.calls)
            except llm.StructuringError as exc:
                warnings.append(f"LLM output failed validation twice ({exc}); used layout parser")
            except Exception as exc:  # network/auth/rate limit: degrade, do not fail the check
                warnings.append(f"LLM call failed ({type(exc).__name__}); used layout parser")

    try:
        parsed = parse_layout(doc)
    except LayoutError as exc:
        warnings.append(f"layout parser could not read this document: {exc}")
        return ExtractionResult(_minimal(doc, str(exc)), warnings, "minimal")
    warnings.extend(parsed.warnings)
    return ExtractionResult(_finalise(parsed.invoice, doc, warnings), warnings, "layout")


def extract(pdf_path: str | Path) -> Invoice:
    return extract_document(pdf_path).invoice


__all__ = ["ExtractionResult", "extract", "extract_document"]
