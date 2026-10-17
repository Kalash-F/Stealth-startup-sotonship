"""Builders for rule tests: a clean one-line invoice, enrichment and band that no rule flags."""

from __future__ import annotations

import copy
from typing import Any

from tbml.fixtures import load_fixture
from tbml.schemas import Benchmark, EnrichedLine, Invoice

MEDIAN = 3.8  # fixture band: p10 1.8, p25 2.6, median 3.8, p75 5.5, p90 8.5 (USD per kg)


def make_line(line_id: str = "L1", **fields: Any) -> dict[str, Any]:
    base = {
        "line_id": line_id,
        "description": "M6 x 30mm hex bolts, zinc plated",
        "quantity": 1000.0,
        "unit": "kg",
        "unit_price": MEDIAN,
        "line_total": MEDIAN * 1000,
        "extraction_confidence": 0.97,
    }
    return {**base, **fields}


def make_invoice(lines: list[dict[str, Any]] | None = None, **fields: Any) -> Invoice:
    data = copy.deepcopy(load_fixture("invoice"))
    data["line_items"] = lines if lines is not None else [make_line()]
    data["stated_total"] = round(sum(ln["line_total"] for ln in data["line_items"]), 2)
    data.update(fields)
    return Invoice.model_validate(data)


def make_enriched(line_id: str = "L1", **fields: Any) -> EnrichedLine:
    data = copy.deepcopy(load_fixture("enriched_line"))
    data.update(
        line_id=line_id,
        classification_confidence=0.95,
        normalised_quantity=1000.0,
        unit_price_usd=MEDIAN,
    )
    data.update(fields)
    return EnrichedLine.model_validate(data)


def make_band(**fields: Any) -> Benchmark:
    data = copy.deepcopy(load_fixture("benchmark"))
    data.update(fields)
    return Benchmark.model_validate(data)


def party(**fields: Any) -> dict[str, Any]:
    base = copy.deepcopy(load_fixture("party"))
    base.update(fields)
    return base
