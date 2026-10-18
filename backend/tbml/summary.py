"""The report's written notes, from ONE LLM call made after the rules have run.

Every prompt that needs the finished flags is answered by the same call: the model gets the report
as compact JSON and replies with one JSON object whose keys separate the parts,

    {"summary": "<1-2 sentences>", "flags": {"<flag_id>": "<note>", ...}}

- `summary` -> `Report.summary`: one or two sentences an officer can read instead of the whole
  report. The UI shows the priority score and band beside it, so it never repeats them.
- `flags` -> `flag.evidence["ai_summary"]` per flag (the frozen schema is unchanged). Off by
  default, `TBML_FLAG_SUMMARIES=1` turns it on: the notes came out generic and the checker does
  not show them. When off, the `flags` part is not asked for at all.

Replies are cached by model, prompt version and input, so re-checking an invoice makes no call.
Offline (no provider) the summary is a fixed template and there are no flag notes. When the call
fails the summary is None and a warning says so, so the notes never block a report.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from tbml.llm import LLMError
from tbml.paths import cache_dir
from tbml.schemas import Flag, Invoice, PriorityBand, ReportLine

log = logging.getLogger("tbml.summary")

CACHE_SUBDIR = "report_notes"
PROMPT_VERSION = "1"
SUMMARY_TOKENS = 160
FLAG_NOTE_TOKENS = 110  # per flag, when flag notes are asked for
MAX_NOTE_CHARS = 400
FAILED = "summary unavailable (LLM call failed)"

_COMMON = """You write the notes for one trade-invoice risk report, read by a bank's trade-finance \
compliance officer. You get the finished report as JSON: the review priority, each red flag (id, \
rule, severity, line, reason), line counts and anything that could not be checked.
Reply with ONE JSON object and nothing else, no markdown fences:
{schema}
"summary": at most 2 sentences and 60 words. Give the main reasons (the flags), most severe first, \
then anything not checked. The priority score and band are shown next to it: do not repeat them.
"""

_FLAGS = """"flags": one entry for every flag id you were given, keyed by that id, at most two \
short sentences each: first why this pattern matters for trade-based money laundering, then one \
concrete thing to ask the customer or check. Do not repeat the numbers.
"""

_RULES = """All text: plain British English, no lists, no em dashes. Use only facts and numbers in \
the input. The priority is a prompt for review, never a fraud verdict: never say fraud or \
laundering happened or that anyone is guilty."""

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


@dataclass
class Notes:
    """What the one call produced: the report summary, a note per flag id, and a warning when the
    call failed."""

    summary: str | None
    flag_notes: dict[str, str] = field(default_factory=dict)
    warning: str | None = None


def flag_notes_enabled() -> bool:
    """Flag notes are asked for only when TBML_FLAG_SUMMARIES is set to 1/true/yes."""
    return os.environ.get("TBML_FLAG_SUMMARIES", "0").lower() in {"1", "true", "yes"}


def system_prompt(flag_notes: bool) -> str:
    """The one system prompt, with the `flags` part only when it is asked for."""
    schema = (
        '{"summary": "<text>", "flags": {"<flag id>": "<text>", ...}}'
        if flag_notes
        else '{"summary": "<text>"}'
    )
    return _COMMON.format(schema=schema) + (_FLAGS if flag_notes else "") + _RULES


def _facts(
    invoice: Invoice | None,
    priority_score: float,
    priority_band: PriorityBand,
    flags: list[Flag],
    lines: list[ReportLine],
    warnings: list[str],
) -> dict[str, Any]:
    facts: dict[str, Any] = {
        "priority_score": round(priority_score),
        "priority_band": BAND_LABEL[priority_band],
        "flags": [
            {
                "id": f.flag_id,
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
    if invoice is not None:
        to = (invoice.consignee or invoice.buyer).country
        facts["route"] = f"{invoice.seller.country} to {to}"
        facts["currency"] = invoice.currency
    return facts


def _cache_path(model: str, system: str, user: str) -> Path:
    key = hashlib.sha256(f"{model}\0{PROMPT_VERSION}\0{system}\0{user}".encode()).hexdigest()
    return cache_dir() / CACHE_SUBDIR / f"{key}.json"


def _tidy(text: str) -> str:
    return re.sub(r"\s*—\s*", ", ", " ".join(text.split()))


def parse_reply(text: str, flag_ids: set[str]) -> tuple[str | None, dict[str, str]]:
    """Split the one reply into (summary, {flag_id: note}). A reply that is plain prose (no JSON
    object) is taken as the summary; notes for unknown flag ids and empty parts are dropped."""
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    start, end = s.find("{"), s.rfind("}")
    if start < 0:
        return (_tidy(s) or None), {}
    if end < start:  # cut off mid-object (token limit): nothing usable
        return None, {}
    try:
        data = json.loads(s[start : end + 1])
    except ValueError:
        return None, {}
    if not isinstance(data, dict):
        return None, {}
    summary = data.get("summary")
    summary = _tidy(summary) if isinstance(summary, str) and summary.strip() else None
    raw = data.get("flags")
    notes = {
        fid: _tidy(note)[:MAX_NOTE_CHARS]
        for fid, note in (raw.items() if isinstance(raw, dict) else [])
        if fid in flag_ids and isinstance(note, str) and note.strip()
    }
    return summary, notes


def write_notes(
    invoice: Invoice | None,
    priority_score: float,
    priority_band: PriorityBand,
    flags: list[Flag],
    lines: list[ReportLine],
    warnings: list[str],
    client: Any = None,
    flag_notes: bool | None = None,
) -> Notes:
    """Every post-rules note in one call (or none: offline, or a cache hit). `flag_notes`
    overrides TBML_FLAG_SUMMARIES."""
    fallback = _template(flags, warnings)
    if client is None:
        return Notes(fallback)
    want_flags = (flag_notes_enabled() if flag_notes is None else flag_notes) and bool(flags)
    system = system_prompt(want_flags)
    user = json.dumps(
        _facts(invoice, priority_score, priority_band, flags, lines, warnings), ensure_ascii=False
    )
    ids = {f.flag_id for f in flags} if want_flags else set()
    path = _cache_path(client.model, system, user)
    if path.is_file():
        try:
            summary, notes = parse_reply(path.read_text(), ids)
            if summary:
                return Notes(summary, notes)
        except OSError:
            pass
    max_tokens = SUMMARY_TOKENS + (FLAG_NOTE_TOKENS * len(flags) if want_flags else 0)
    try:
        reply = client.complete(system, [{"role": "user", "content": user}], max_tokens=max_tokens)
    except LLMError as exc:
        log.warning("report notes LLM call failed: %s", exc)
        return Notes(None, warning=FAILED)
    summary, notes = parse_reply(reply, ids)
    if summary:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"summary": summary, "flags": notes}, indent=2) + "\n")
        except OSError:
            pass  # read-only disk: still return the answer
    return Notes(summary or fallback, notes)


def with_flag_notes(flags: list[Flag], notes: dict[str, str]) -> list[Flag]:
    """The flags with `evidence["ai_summary"]` added where the call wrote a note."""
    if not notes:
        return flags
    return [
        f.model_copy(update={"evidence": {**f.evidence, "ai_summary": notes[f.flag_id]}})
        if f.flag_id in notes
        else f
        for f in flags
    ]


def _template(flags: list[Flag], warnings: list[str]) -> str:
    if not flags:
        text = "No red flags raised."
    else:
        high = sum(1 for f in flags if f.severity == "high")
        rules = list(dict.fromkeys(RULE_LABEL.get(f.rule.value, f.rule.value) for f in flags))
        line_ids = list(dict.fromkeys(lid for f in flags if (lid := f.line_id)))
        count = f"{len(flags)} flag{'s' if len(flags) != 1 else ''}"
        if high:
            count += f", {high} high severity"
        where = f" on {', '.join(line_ids)}" if line_ids else ""
        text = f"{count}: {', '.join(rules)}{where}."
    if warnings:
        text += f" {len(warnings)} check{'s' if len(warnings) != 1 else ''} could not run fully."
    return text


__all__ = ["Notes", "flag_notes_enabled", "parse_reply", "with_flag_notes", "write_notes"]
