"""AI summary per flag: one LLM call per report turns each rule's reason into two short sentences
for a compliance officer (why it matters for trade-based money laundering, what to ask next).

The summary goes into `flag.evidence["ai_summary"]`, so the frozen schema is unchanged. The rule's
own `reason` stays the source of truth: summaries never add numbers and never call anything fraud.
Replies are cached (the temp dir on Vercel, with the committed data/cache as a read-only
fallback). With no provider configured, or on any failure, reports simply have no summaries.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
from pathlib import Path
from typing import Any

from tbml.llm import LLMError, configured_client
from tbml.paths import DATA_DIR, cache_dir
from tbml.schemas import Flag, Invoice

log = logging.getLogger("tbml.summarise")

CACHE_SUBDIR = "flag_summaries"
PROMPT_VERSION = "1"
MAX_CHARS = 400
CACHE_MODEL = "google/gemini-2.5-flash"  # model the committed summaries were made with

SYSTEM = (
    "You help a bank's trade-finance compliance officer review one trade invoice. For each red "
    "flag you get the rule that fired and its reason. Write at most two short, plain sentences per "
    "flag: first why this pattern matters for trade-based money laundering (for example, "
    "over-invoicing moves extra money to the seller disguised as payment for goods), then one "
    "concrete thing the officer could ask the customer or check. Do not repeat the numbers, do not "
    "add facts that are not in the reason, and never say the invoice is fraud or that anyone is "
    "guilty: these are prompts for review. Plain British English, no jargon, no em dashes.\n"
    'Reply with JSON only: {"summaries": {"<flag_id>": "<text>", ...}}'
)


def enabled() -> bool:
    """Summaries run unless TBML_FLAG_SUMMARIES is set to 0/false/no."""
    return os.environ.get("TBML_FLAG_SUMMARIES", "1").lower() not in {"0", "false", "no"}


def _prompt(invoice: Invoice, flags: list[Flag]) -> str:
    head = (
        f"Invoice from {invoice.seller.country} to {(invoice.consignee or invoice.buyer).country}, "
        f"currency {invoice.currency}."
    )
    body = "\n".join(
        f"- {f.flag_id} ({f.rule.value}, {f.severity.value}): {f.reason}" for f in flags
    )
    return f"{head}\nFlags:\n{body}"


def _cache_paths(model: str, prompt: str) -> tuple[Path, Path]:
    key = hashlib.sha256(f"{model}\0{PROMPT_VERSION}\0{prompt}".encode()).hexdigest()
    name = f"{key}.json"
    return cache_dir() / CACHE_SUBDIR / name, DATA_DIR / "cache" / CACHE_SUBDIR / name


def _parse(text: str, ids: set[str]) -> dict[str, str]:
    try:
        data = json.loads(text[text.find("{") : text.rfind("}") + 1])
    except ValueError:
        return {}
    raw = data.get("summaries", {}) if isinstance(data, dict) else {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for fid, summary in raw.items():
        if fid in ids and isinstance(summary, str) and summary.strip():
            out[fid] = re.sub(r"\s*\u2014\s*", ", ", " ".join(summary.split()))[:MAX_CHARS]
    return out


def summarise(invoice: Invoice, flags: list[Flag], client: Any = None) -> dict[str, str]:
    """flag_id -> summary. Empty when there is nothing to do, no provider, or the call fails."""
    if not flags or not enabled():
        return {}
    client = client or configured_client()
    # Offline, the committed answers for the bundled samples still show (cache lookup only).
    model = (
        client.model if client is not None else os.environ.get("OPENROUTER_MODEL") or CACHE_MODEL
    )
    prompt = _prompt(invoice, flags)
    ids = {f.flag_id for f in flags}
    path, bundled = _cache_paths(model, prompt)
    for p in (path, bundled):
        if p.is_file():
            try:
                return _parse(p.read_text(), ids)
            except OSError:
                pass
    if client is None:
        return {}
    try:
        text = client.complete(SYSTEM, [{"role": "user", "content": prompt}], max_tokens=1200)
    except LLMError as exc:
        log.warning("flag summaries skipped: %s", exc)
        return {}
    result = _parse(text, ids)
    if result:
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"summaries": result}, indent=2) + "\n")
        except OSError:
            pass  # read-only disk: still return the answer
    return result


def with_summaries(invoice: Invoice, flags: list[Flag], client: Any = None) -> list[Flag]:
    """The flags with `evidence["ai_summary"]` added where a summary came back."""
    summaries = summarise(invoice, flags, client)
    if not summaries:
        return flags
    return [
        f.model_copy(update={"evidence": {**f.evidence, "ai_summary": summaries[f.flag_id]}})
        if f.flag_id in summaries
        else f
        for f in flags
    ]


__all__ = ["summarise", "with_summaries"]
