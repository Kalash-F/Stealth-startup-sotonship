"""R3 PLACEHOLDER_DESC: vague goods descriptions that hide what is really being shipped."""

from __future__ import annotations

import re
from functools import lru_cache

from tbml.rules._common import config, make_flag
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


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
    """Flag descriptions that match a placeholder pattern, or are very short and unclassifiable.

    High when the wording is vague and the line also failed HS6 classification (the goods are
    unknowable); medium otherwise."""
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
        if matched is None and not (short and unclassified):
            continue
        # A vague wording the system also could not classify is the strongest case: the goods are unknowable.
        high = matched is not None and unclassified
        why = (
            "is too vague to say what the goods are"
            if matched is not None
            else f"is only {words} word{'s' if words != 1 else ''} long and could not be matched to any product"
        )
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
                    "classified": not unclassified,
                    "hs6": None if e is None else e.hs6,
                },
                stated=text,
            )
        )
    return flags
