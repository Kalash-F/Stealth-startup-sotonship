"""Reference list of valid HS6 codes (data/reference/hs6.csv)."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from tbml.paths import REFERENCE_DIR

HS6_CSV = REFERENCE_DIR / "hs6.csv"


@dataclass(frozen=True)
class HS6Entry:
    hs6: str
    description: str
    keywords: tuple[re.Pattern[str], ...]  # used by the offline KeywordProposer only
    exclude: re.Pattern[str] | None


def _split(field: str) -> list[str]:
    # Keywords are `|`-separated; an exclude field is a single regex and is not split.
    return [p for p in field.split("|") if p]


def load_hs6(path: Path = HS6_CSV) -> dict[str, HS6Entry]:
    entries: dict[str, HS6Entry] = {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            keywords = tuple(
                re.compile(rf"(?<![a-z])(?:{kw})(?![a-z])") for kw in _split(row["keywords"])
            )
            exclude = re.compile(row["exclude"]) if row["exclude"] else None
            entries[row["hs6"]] = HS6Entry(row["hs6"], row["description"], keywords, exclude)
    return entries


@lru_cache(maxsize=1)
def default_hs6() -> dict[str, HS6Entry]:
    return load_hs6()
