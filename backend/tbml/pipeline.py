"""Chains every stage: PDF -> Invoice -> EnrichedLine -> Benchmark -> Flag -> Report (+ summary).

`USE_MOCKS=1` swaps extraction and benchmarking for the Phase 0 fixtures (see stubs.py).
"""

import logging
import os
import time
from pathlib import Path

from tbml import stubs
from tbml.benchmark import benchmark
from tbml.classify import enrich
from tbml.extract import extract_document
from tbml.llm import summary_client
from tbml.rules import run_rules_with_warnings
from tbml.schemas import SCHEMA_VERSION, Report, ReportLine
from tbml.score import score
from tbml.summary import summarise

log = logging.getLogger("tbml.pipeline")


def use_mocks() -> bool:
    return os.environ.get("USE_MOCKS", "").lower() in {"1", "true", "yes"}


def check(pdf_path: str | Path) -> Report:
    start = time.perf_counter()
    timings: dict[str, int] = {}

    def lap(stage: str, since: float) -> float:
        now = time.perf_counter()
        timings[stage] = int((now - since) * 1000)
        return now

    mocks = use_mocks()
    t = lap("start", start)
    extraction = (stubs.extract_document if mocks else extract_document)(pdf_path)
    t = lap("extract", t)
    invoice = extraction.invoice
    enriched = enrich(invoice)
    t = lap("classify", t)
    # Same route R5 uses: seller's country to the consignee's (else buyer's) country.
    route = f"{invoice.seller.country}-{(invoice.consignee or invoice.buyer).country}"
    bench = stubs.benchmark if mocks else benchmark
    benchmarks = [bench(line, route) for line in enriched]
    t = lap("benchmark", t)
    flags, rule_warnings = run_rules_with_warnings(invoice, enriched, benchmarks)
    priority_score, priority_band = score(flags)
    t = lap("rules", t)

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
    warnings.extend(w for w in rule_warnings if w not in warnings)
    summary, summary_warning = summarise(
        priority_score, priority_band, flags, lines, warnings, client=summary_client()
    )
    if summary_warning:
        warnings.append(summary_warning)
    lap("summary", t)

    processing_ms = int((time.perf_counter() - start) * 1000)
    timings.pop("start", None)
    log.info("checked %s in %d ms (%s)", invoice.invoice_id, processing_ms, timings)
    return Report(
        invoice_id=invoice.invoice_id,
        schema_version=SCHEMA_VERSION,
        priority_score=priority_score,
        priority_band=priority_band,
        summary=summary,
        flags=flags,
        lines=lines,
        processing_ms=processing_ms,
        warnings=warnings,
    )


__all__ = ["check", "use_mocks"]
