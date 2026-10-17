"""Chains every stage: PDF -> Invoice -> EnrichedLine -> Benchmark -> Flag -> Report."""

import time
from pathlib import Path

from tbml.benchmark import benchmark
from tbml.classify import enrich
from tbml.extract import extract_document
from tbml.rules import run_rules
from tbml.schemas import SCHEMA_VERSION, Report, ReportLine
from tbml.score import score


def check(pdf_path: str | Path) -> Report:
    start = time.perf_counter()
    extraction = extract_document(pdf_path)
    invoice = extraction.invoice
    enriched = enrich(invoice)
    benchmarks = [benchmark(line) for line in enriched]
    flags = run_rules(invoice, enriched, benchmarks)
    priority_score, priority_band = score(flags)

    by_id = {e.line_id: (e, b) for e, b in zip(enriched, benchmarks, strict=True)}
    lines: list[ReportLine] = []
    warnings: list[str] = list(extraction.warnings)
    for item in invoice.line_items:
        if item.line_id not in by_id:
            warnings.append(f"line {item.line_id} could not be enriched")
            continue
        e, b = by_id[item.line_id]
        enriched_fields = e.model_dump(exclude={"line_id"})
        lines.append(ReportLine(**item.model_dump(), **enriched_fields, benchmark=b))
        if e.hs6 is None:
            warnings.append(f"line {item.line_id} could not be classified")

    return Report(
        invoice_id=invoice.invoice_id,
        schema_version=SCHEMA_VERSION,
        priority_score=priority_score,
        priority_band=priority_band,
        flags=flags,
        lines=lines,
        processing_ms=int((time.perf_counter() - start) * 1000),
        warnings=warnings,
    )


__all__ = ["check"]
