"""Plan 2.1: PDF -> text, tables and positioned words (pdfplumber)."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber


@dataclass
class Word:
    text: str
    x0: float
    x1: float
    top: float
    bottom: float
    bold: bool
    size: float = 0.0

    @property
    def xc(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def yc(self) -> float:
        return (self.top + self.bottom) / 2


@dataclass
class RawPage:
    width: float
    height: float
    text: str
    words: list[Word]
    tables: list[list[list[str]]]


@dataclass
class RawDocument:
    path: Path
    sha256: str
    pages: list[RawPage] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(p.text for p in self.pages)

    @property
    def has_text(self) -> bool:
        return bool(self.text.strip())

    def render(self) -> str:
        """Text plus tables, in the form sent to the LLM and stored for debugging."""
        out: list[str] = []
        for i, page in enumerate(self.pages, 1):
            out.append(f"--- page {i} text ---\n{page.text}")
            for j, table in enumerate(page.tables, 1):
                rows = "\n".join(" | ".join(c.replace("\n", " ") for c in row) for row in table)
                out.append(f"--- page {i} table {j} ---\n{rows}")
        return "\n".join(out)


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pdf(path: str | Path) -> RawDocument:
    path = Path(path)
    doc = RawDocument(path=path, sha256=file_sha256(path))
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words = [
                Word(
                    w["text"],
                    w["x0"],
                    w["x1"],
                    w["top"],
                    w["bottom"],
                    "bold" in w["fontname"].lower(),
                    float(w["size"]),
                )
                for w in page.extract_words(
                    extra_attrs=["fontname", "size"], keep_blank_chars=False
                )
            ]
            tables = [
                [[(c or "").strip() for c in row] for row in t if row]
                for t in page.extract_tables()
            ]
            doc.pages.append(
                RawPage(
                    float(page.width),
                    float(page.height),
                    page.extract_text() or "",
                    words,
                    tables,
                )
            )
    return doc
