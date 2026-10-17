"""The HS tree (chapters -> headings -> six-digit subheadings) used by the hierarchical classifier.

Reads any CSV with a code column and a description column. Codes may carry dots or spaces
("8471.30", "84 71 30") and may be 2, 4, 6 or more digits: longer national codes (8 or 10
digits) are folded into their six-digit parent. Levels missing from the file are derived from
their children, so a file of six-digit codes alone still gives a usable tree (the derived
chapter and heading descriptions are then only "Chapter 84" / "Heading 8471").

Also reads the SQLite database built by backend/scripts/load_hs_json.py (tables hs2, hs4, hs6
with *_code and name columns; source: UN Comtrade "Combined HS" reference list).

File lookup: `HS_NOMENCLATURE` env var (a .csv or a .db), else the repo-root hs.db, else
data/reference/hs_nomenclature.csv, else the partial data/reference/hs6.csv.
"""

from __future__ import annotations

import csv
import os
import re
import sqlite3
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from tbml.paths import REFERENCE_DIR, REPO_ROOT

HS_DB = REPO_ROOT / "hs.db"
NOMENCLATURE_CSV = REFERENCE_DIR / "hs_nomenclature.csv"
FALLBACK_CSV = REFERENCE_DIR / "hs6.csv"

CODE_COLUMNS = ("code", "hs_code", "hscode", "hs", "hs6", "commodity_code", "id")
DESC_COLUMNS = ("description", "desc", "text", "label", "name")

LEVELS = (2, 4, 6)
# Not real goods: 99 is UN Comtrade's statistical catch-all "Commodities not specified according
# to kind" (999999), 77 is reserved by the WCO. Letting the model pick them would hide the goods.
EXCLUDED_CHAPTERS = ("77", "99")
LEVEL_NAMES = {2: "chapter", 4: "heading", 6: "subheading"}


@dataclass
class Nomenclature:
    """HS codes by level. `descriptions` holds every code (2, 4 and 6 digits)."""

    descriptions: dict[str, str] = field(default_factory=dict)
    source: str = ""

    def children(self, parent: str | None) -> list[tuple[str, str]]:
        """Codes one level below `parent` (chapters when parent is None), sorted."""
        if parent is None:
            length, prefix = 2, ""
        else:
            length, prefix = len(parent) + 2, parent
        return sorted(
            (code, desc)
            for code, desc in self.descriptions.items()
            if len(code) == length and code.startswith(prefix)
        )

    def hs6_codes(self) -> dict[str, str]:
        """Every six-digit code with its description."""
        return {c: d for c, d in self.descriptions.items() if len(c) == 6}

    def describe(self, code: str) -> str:
        return self.descriptions.get(code, "")


def _pick(fieldnames: list[str], wanted: tuple[str, ...]) -> str | None:
    lowered = {re.sub(r"[\s\-]+", "_", name.strip().lower()): name for name in fieldnames}
    for want in wanted:
        if want in lowered:
            return lowered[want]
    return None


def load_nomenclature(path: Path) -> Nomenclature:
    """Read a code/description CSV, or an hs.db SQLite file, into a three-level tree. Raises
    ValueError if the columns/tables cannot be found or no usable code is present."""
    if Path(path).suffix.lower() in (".db", ".sqlite", ".sqlite3"):
        return _load_sqlite(Path(path))
    found: dict[str, str] = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        code_col, desc_col = _pick(fields, CODE_COLUMNS), _pick(fields, DESC_COLUMNS)
        if not code_col or not desc_col:
            raise ValueError(
                f"{path.name}: need a code column ({', '.join(CODE_COLUMNS)}) and a description "
                f"column ({', '.join(DESC_COLUMNS)}); found {fields}"
            )
        for row in reader:
            digits = re.sub(r"\D", "", row.get(code_col) or "")
            desc = " ".join((row.get(desc_col) or "").split())
            if len(digits) % 2 == 1 and len(digits) in (1, 3, 5):
                digits = "0" + digits  # spreadsheets drop the leading zero of chapters 01-09
            if len(digits) < 2:
                continue
            if len(digits) > 6:  # national tariff lines fold into their HS6 parent
                found.setdefault(digits[:6], desc)
                continue
            if len(digits) in LEVELS:
                found[digits] = desc  # a row at exactly this level wins over a folded child

    return _finish(found, path)


def _load_sqlite(path: Path) -> Nomenclature:
    """hs.db from backend/scripts/load_hs_json.py: tables hs2/hs4/hs6, columns <table>_code, name."""
    if not path.exists():
        raise ValueError(f"{path.name}: file not found")
    found: dict[str, str] = {}
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        for table in ("hs2", "hs4", "hs6"):
            try:
                rows = con.execute(f"SELECT {table}_code, name FROM {table}").fetchall()
            except sqlite3.Error as exc:
                raise ValueError(f"{path.name}: cannot read table {table}: {exc}") from exc
            for code, name in rows:
                digits = re.sub(r"\D", "", str(code))
                if len(digits) in LEVELS:
                    found[digits] = " ".join(str(name or "").split())
    finally:
        con.close()
    return _finish(found, path)


def _finish(found: dict[str, str], path: Path) -> Nomenclature:
    found = {c: d for c, d in found.items() if c[:2] not in EXCLUDED_CHAPTERS}
    if not any(len(c) == 6 for c in found):
        raise ValueError(f"{path.name}: no six-digit codes found")

    # derive missing parents so every six-digit code hangs off a heading and a chapter
    for code in [c for c in found if len(c) == 6]:
        for length, name in ((4, "Heading"), (2, "Chapter")):
            found.setdefault(code[:length], f"{name} {code[:length]}")
    return Nomenclature(found, source=path.name)


def nomenclature_path() -> Path:
    env = os.environ.get("HS_NOMENCLATURE")
    if env:
        return Path(env)
    for candidate in (HS_DB, NOMENCLATURE_CSV):
        if candidate.exists():
            return candidate
    return FALLBACK_CSV


@lru_cache(maxsize=1)
def default_nomenclature() -> Nomenclature:
    """The bundled nomenclature, loaded once."""
    return load_nomenclature(nomenclature_path())
