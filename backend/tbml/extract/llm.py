"""Plan 2.2 / 2.5: LLM structuring with schema validation, one retry, and a file-hash cache."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from pydantic import ValidationError

from tbml.extract.pdftext import RawDocument
from tbml.paths import REPO_ROOT, cache_dir
from tbml.schemas import Invoice

# Bump when the prompt or the post-processing contract changes; invalidates the cache.
PROMPT_VERSION = "1"

SYSTEM_PROMPT = """\
You extract structured data from commercial invoices for a trade-compliance checker. You are
given the text and tables extracted from one invoice PDF (column order may be scrambled where the
layout had side-by-side blocks). Reply with ONE JSON object matching the schema below and
nothing else: no prose, no markdown fences.

Rules:
- Copy every number exactly as printed. NEVER correct, recompute or round numbers, even when the
arithmetic is wrong: a wrong total is a finding, not a typo. Do not convert currencies.
- Quantities, unit prices, line totals and the stated total are plain numbers (no thousands
separators or currency symbols). `stated_total` is the invoice grand total as printed.
- `line_items`: one per goods line, in document order, with line_id "L1", "L2", ... . Keep the
description wording as printed (fix only line-wrap artefacts). `unit` is the unit of measure as
printed (pcs, kg, cartons, ...).
- `invoice_date` is ISO (YYYY-MM-DD). Read DD/MM/YYYY dates as day first.
- `seller` is the exporter/shipper. `buyer` is the bill-to party. `consignee` is a separate
ship-to party; use null when the invoice says "same as buyer", "as billing address" or gives none.
- `country` is the ISO-3166 alpha-2 code of the party's address (e.g. GB, AE, CN, CZ).
`currency` is ISO-4217 (e.g. USD). Use null for `country_of_origin`, ports and `incoterm` when
absent; otherwise copy them as printed (do not normalise the origin text; keep any
"re-exported from ..." note).
- `address_type`: "residential" for a private home (flat, apartment, house), "commercial" for
offices, warehouses, industrial or business premises, "unknown" when you cannot tell (e.g. a
P.O. box).
- `extraction_confidence` per line is 0-1: your confidence the line was read correctly.
- Set `source_file` to "" and `is_synthetic` to false; they are overwritten afterwards.

JSON schema:
"""


class LLMClient(Protocol):
    """Minimal client surface so tests can pass a fake: a model name and one `complete` call."""

    model: str

    def complete(self, system: str, messages: list[dict[str, str]]) -> str:
        """Send the conversation and return the reply text."""
        ...


class AnthropicClient:
    """LLMClient over the Anthropic Messages API (temperature 0 where the model allows it)."""

    def __init__(self, model: str, api_key: str | None = None):
        import anthropic

        self._anthropic = anthropic
        self.model = model
        self._client = anthropic.Anthropic(api_key=api_key)

    def complete(self, system: str, messages: list[dict[str, str]]) -> str:
        """Send one request and return the concatenated text blocks of the reply."""
        kwargs: dict[str, Any] = {
            "model": self.model,
            "max_tokens": 8192,
            "system": system,
            "messages": messages,
        }
        try:
            resp = self._client.messages.create(temperature=0, **kwargs)
        except self._anthropic.BadRequestError as exc:
            if "temperature" not in str(exc).lower():
                raise
            resp = self._client.messages.create(**kwargs)  # model rejects the temperature knob
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")


def _load_dotenv() -> None:
    """Copy KEY=value lines from the repo-root .env into os.environ without overriding real env
    vars."""
    env = REPO_ROOT / ".env"
    if not env.is_file():
        return
    for raw in env.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if value.strip():
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def configured_client() -> LLMClient | None:
    """An Anthropic client when ANTHROPIC_API_KEY and LLM_MODEL are set (env or .env), else None."""
    _load_dotenv()
    key, model = os.environ.get("ANTHROPIC_API_KEY"), os.environ.get("LLM_MODEL")
    if not (key and model):
        return None
    return AnthropicClient(model, key)


class StructuringError(Exception):
    """The LLM did not produce a valid Invoice after the retry."""


def cache_path(sha256: str, root: Path | None = None) -> Path:
    """File for one document's cached reply; the prompt version in the name invalidates old
    entries."""
    return (root or cache_dir()) / "llm" / f"{sha256}-v{PROMPT_VERSION}.json"


def read_cache(sha256: str, root: Path | None = None) -> dict[str, Any] | None:
    """The cached invoice payload, or None on a miss or a corrupt entry."""
    path = cache_path(sha256, root)
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text())["invoice"]
    except (ValueError, KeyError):
        return None  # corrupt entry: treat as a miss


def write_cache(sha256: str, model: str, payload: dict[str, Any], root: Path | None = None) -> None:
    """Store a validated payload with the model and prompt version that produced it."""
    path = cache_path(sha256, root)
    path.parent.mkdir(parents=True, exist_ok=True)
    entry = {"model": model, "prompt_version": PROMPT_VERSION, "invoice": payload}
    path.write_text(json.dumps(entry, indent=2, sort_keys=True) + "\n")


def _json_object(text: str) -> dict[str, Any]:
    """Extract the JSON object from a reply, tolerating code fences and surrounding prose."""
    s = text.strip()
    s = re.sub(r"^```(?:json)?\s*|\s*```$", "", s)
    start, end = s.find("{"), s.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no JSON object in the reply")
    obj = json.loads(s[start : end + 1])
    if not isinstance(obj, dict):
        raise ValueError("reply is not a JSON object")
    return obj


def validate_payload(payload: dict[str, Any], source_file: str) -> Invoice:
    """Validate a model payload as an Invoice, forcing `source_file` and `is_synthetic=False`."""
    return Invoice.model_validate({**payload, "source_file": source_file, "is_synthetic": False})


@dataclass
class StructuredReply:
    """A validated payload and the number of LLM calls (1 or 2) it took."""

    payload: dict[str, Any]
    calls: int


def structure(doc: RawDocument, client: LLMClient) -> StructuredReply:
    """Ask the LLM for an Invoice; on a parse/validation failure retry once with the error."""
    system = SYSTEM_PROMPT + json.dumps(Invoice.model_json_schema(), separators=(",", ":"))
    user = f"File: {doc.path.name}\n\n{doc.render()}"
    messages = [{"role": "user", "content": user}]
    error = ""
    for attempt in (1, 2):
        reply = client.complete(system, messages)
        try:
            payload = _json_object(reply)
            validate_payload(payload, doc.path.name)
            return StructuredReply(payload, attempt)
        except (ValueError, ValidationError) as exc:
            error = str(exc)
            messages = [
                *messages,
                {"role": "assistant", "content": reply},
                {
                    "role": "user",
                    "content": "That reply failed validation:\n"
                    f"{error}\nReturn the corrected JSON object only.",
                },
            ]
    raise StructuringError(error)
