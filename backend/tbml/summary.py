"""Report.summary: one or two sentences an officer can read instead of the whole report.

Written by the LLM from the finished report fields (score, band, flags, warnings); a fixed
template when no provider is configured. None when the LLM call fails, so a summary never blocks a
report.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from tbml.llm import LLMError
from tbml.schemas import Flag, PriorityBand, ReportLine

log = logging.getLogger("tbml.summary")

MAX_TOKENS = 120

SYSTEM = """You summarise a trade-invoice risk report for a customs officer.
Write at most 2 sentences and 60 words, plain English, no lists or markdown.
Lead with the review priority, then the main reasons (the flags), then anything not checked.
The score is a review priority, never a fraud verdict: do not say fraud or laundering happened.
Use only facts and numbers present in the input."""

BAND_LABEL = {
    PriorityBand.review_now: "Review now",
    PriorityBand.review: "Review",
    PriorityBand.low: "Low priority",
}

RULE_LABEL = {
    "PRICE_OUTLIER": "price outlier",
    "QTY_VALUE_IMPLAUSIBLE": "implausible quantity/value",
    "PLACEHOLDER_DESC": "vague goods description",
    "GEO_INCONSISTENT": "inconsistent geography",
    "ROUTE_NO_ECONOMIC_SENSE": "route makes no economic sense",
    "ARITHMETIC_ERROR": "arithmetic error",
    "RESIDENTIAL_CONSIGNEE": "residential consignee",
    "LOW_CONFIDENCE": "low extraction confidence",
}


def summarise(
    priority_score: float,
    priority_band: PriorityBand,
    flags: list[Flag],
    lines: list[ReportLine],
    warnings: list[str],
    client: Any = None,
) -> tuple[str | None, str | None]:
    """(summary, warning). Both flip when the LLM was asked and failed: no summary, a warning."""
    fallback = _template(priority_score, priority_band, flags, warnings)
    if client is None:
        return fallback, None
    facts = {
        "priority_score": round(priority_score),
        "priority_band": BAND_LABEL[priority_band],
        "flags": [
            {
                "rule": f.rule.value,
                "severity": f.severity.value,
                "line": f.line_id,
                "reason": f.reason,
            }
            for f in flags
        ],
        "lines": len(lines),
        "unclassified_lines": sum(1 for line in lines if line.hs6 is None),
        "warnings": warnings,
    }
    try:
        reply = client.complete(
            SYSTEM,
            [{"role": "user", "content": json.dumps(facts, ensure_ascii=False)}],
            max_tokens=MAX_TOKENS,
        )
    except LLMError as exc:
        log.warning("summary LLM call failed: %s", exc)
        return None, "summary unavailable (LLM call failed)"
    text = re.sub(r"\s+", " ", reply).strip()
    return text or fallback, None


def _template(
    priority_score: float, priority_band: PriorityBand, flags: list[Flag], warnings: list[str]
) -> str:
    head = f"{BAND_LABEL[priority_band]} (score {round(priority_score)})"
    if not flags:
        text = f"{head}: no red flags raised."
    else:
        high = sum(1 for f in flags if f.severity == "high")
        rules = list(dict.fromkeys(RULE_LABEL.get(f.rule.value, f.rule.value) for f in flags))
        line_ids = list(dict.fromkeys(lid for f in flags if (lid := f.line_id)))
        count = f"{len(flags)} flag{'s' if len(flags) != 1 else ''}"
        if high:
            count += f", {high} high severity"
        where = f" on {', '.join(line_ids)}" if line_ids else ""
        text = f"{head}: {count} - {', '.join(rules)}{where}."
    if warnings:
        text += f" {len(warnings)} check{'s' if len(warnings) != 1 else ''} could not run fully."
    return text


__all__ = ["summarise"]
