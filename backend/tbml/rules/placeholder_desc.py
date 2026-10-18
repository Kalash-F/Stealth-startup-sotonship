"""R3 PLACEHOLDER_DESC: vague goods descriptions that hide what is really being shipped."""

from __future__ import annotations

import re
from functools import lru_cache

from tbml.classify.hierarchical import VAGUE_STOP
from tbml.rules._common import config, make_flag
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity

_READ_AS = re.compile(r'read as "([^"]*)"')


def ai_called_vague(e: EnrichedLine | None) -> tuple[bool, str | None]:
    """(did the AI classifier stop because the wording names no goods?, its plain reading)."""
    if e is None or e.hs6 is not None or f"stopped: {VAGUE_STOP}" not in e.normalisation_note:
        return False, None
    m = _READ_AS.search(e.normalisation_note)
    return True, (m.group(1) if m else None)


@lru_cache(maxsize=1)
def _patterns() -> list[re.Pattern[str]]:
    """Placeholder regexes from config.yaml, compiled once."""
    return [re.compile(p) for p in config("placeholder_desc")["patterns"]]


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    """Flag descriptions that match a placeholder pattern, that the AI classifier judged too vague
    to name any goods, or that are very short and unclassifiable.

    High when the wording is vague (by pattern or by the AI) and the line also failed HS6
    classification (the goods are unknowable); medium otherwise."""
    cfg = config("placeholder_desc")
    by_id = {e.line_id: e for e in enriched}
    flags: list[Flag] = []
    for item in invoice.line_items:
        e = by_id.get(item.line_id)
        text = item.description.strip()
        matched = next((p.pattern for p in _patterns() if p.search(text)), None)
        words = len(text.split())
        unclassified = e is None or e.hs6 is None
        short = words < cfg["min_words"]
        ai_vague, read_as = ai_called_vague(e)
        if matched is None and not ai_vague and not (short and unclassified):
            continue
        # A vague wording the system also could not classify is the strongest case: the goods are unknowable.
        high = (matched is not None or ai_vague) and unclassified
        if matched is not None:
            why = "is too vague to say what the goods are"
        elif ai_vague:
            why = "does not name any specific goods (the AI classifier read it as " + (
                f'"{read_as}")' if read_as else "too general to classify)"
            )
        else:
            why = f"is only {words} word{'s' if words != 1 else ''} long and could not be matched to any product"
        reason = f'Line {item.line_id} describes the goods only as "{text}", which {why}. ' + (
            "Because the goods cannot be identified, their price cannot be checked."
            if unclassified
            else "A vague description makes it hard to confirm what is actually being shipped."
        )
        flags.append(
            make_flag(
                Rule.PLACEHOLDER_DESC,
                item.line_id,
                Severity.high if high else Severity.medium,
                reason,
                {
                    "description": text,
                    "word_count": words,
                    "min_words": cfg["min_words"],
                    "matched_pattern": matched,
                    "ai_vague": ai_vague,
                    "ai_reading": read_as,
                    "classified": not unclassified,
                    "hs6": None if e is None else e.hs6,
                },
                stated=text,
            )
        )
    return flags
