"""Field-level comparison of an extracted `Invoice` against ground truth (plan.md 2.6).

Numeric fields match within 0.01; strings by normalised equality (NFKC, case-folded, whitespace
collapsed). `extraction_confidence` is not compared: it is our own estimate, not a document field.
"""

from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass

from tbml.schemas import Invoice, Party

# The four fields plan.md Checkpoint 2 holds to >= 98%.
STRICT_FIELDS = ("quantity", "unit_price", "line_total", "stated_total")


@dataclass(frozen=True)
class FieldResult:
    """Outcome of comparing one field of one invoice against ground truth."""

    invoice_id: str
    field: str
    ok: bool
    expected: object
    got: object

    @property
    def strict(self) -> bool:
        """True for the numeric fields the checkpoint holds to a high accuracy bar."""
        return self.field.rsplit(".", 1)[-1] in STRICT_FIELDS


def norm(value: object) -> str | None:
    """Normalise for comparison: NFKC, case-folded, whitespace collapsed; None stays None."""
    if value is None:
        return None
    s = unicodedata.normalize("NFKC", str(value)).casefold()
    return re.sub(r"\s+", " ", s).strip()


def _eq(expected: object, got: object) -> bool:
    """Numbers match within 0.01; everything else by normalised string equality."""
    if isinstance(expected, int | float) and not isinstance(expected, bool):
        return isinstance(got, int | float) and abs(float(expected) - float(got)) <= 0.01
    return norm(expected) == norm(got)


def _party(prefix: str, exp: Party | None, got: Party | None) -> list[tuple[str, object, object]]:
    """Rows for one party; a missing party compares presence only."""
    if exp is None or got is None:
        return [(prefix, exp is None, got is None)]
    return [
        (f"{prefix}.{f}", getattr(exp, f), getattr(got, f))
        for f in ("name", "address", "country", "address_type")
    ]


def compare(truth: Invoice, got: Invoice) -> list[FieldResult]:
    """Compare header fields, the three parties, the line count and each line field by position."""
    rows: list[tuple[str, object, object]] = []
    for f in (
        "invoice_id",
        "invoice_date",
        "country_of_origin",
        "port_of_loading",
        "port_of_discharge",
        "incoterm",
        "currency",
        "stated_total",
        "source_file",
        "is_synthetic",
    ):
        rows.append((f, getattr(truth, f), getattr(got, f)))
    rows += _party("seller", truth.seller, got.seller)
    rows += _party("buyer", truth.buyer, got.buyer)
    rows += _party("consignee", truth.consignee, got.consignee)
    rows.append(("line_count", len(truth.line_items), len(got.line_items)))
    for i, t in enumerate(truth.line_items):
        g = got.line_items[i] if i < len(got.line_items) else None
        for f in ("description", "unit", "quantity", "unit_price", "line_total"):
            rows.append((f"line.{f}", getattr(t, f), getattr(g, f) if g else None))
    return [
        FieldResult(truth.invoice_id, name, _eq_value(exp, val), exp, val)
        for name, exp, val in rows
    ]


def _eq_value(exp: object, got: object) -> bool:
    """`_eq` with dates compared as ISO strings."""
    if hasattr(exp, "isoformat"):
        exp, got = str(exp), str(got)
    return _eq(exp, got)


def summarise(results: list[FieldResult]) -> dict[str, tuple[int, int]]:
    """{group: (correct, total)} for the strict numeric fields, all other fields, and per field."""
    out: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for r in results:
        for key in ("strict" if r.strict else "other", r.field):
            out[key][0] += r.ok
            out[key][1] += 1
    return {k: (v[0], v[1]) for k, v in out.items()}


def report(results: list[FieldResult]) -> str:
    """Printable accuracy summary: strict and other totals, per-field rates, then every miss."""
    s = summarise(results)
    lines = []
    for group in ("strict", "other"):
        ok, n = s[group]
        label = "quantity/unit_price/line_total/stated_total" if group == "strict" else "all other"
        lines.append(f"{label}: {ok}/{n} = {100 * ok / n:.2f}%")
    lines.append("")
    for name in sorted(k for k in s if k not in ("strict", "other")):
        ok, n = s[name]
        lines.append(f"  {name:28s} {ok:4d}/{n:<4d} {100 * ok / n:6.2f}%")
    misses = [r for r in results if not r.ok]
    lines.append(f"\n{len(misses)} misses")
    for r in misses:
        lines.append(f"  {r.invoice_id} {r.field}: expected {r.expected!r}, got {r.got!r}")
    return "\n".join(lines)


def main() -> int:
    """python -m tbml.extract.scoring: accuracy of the current extractor over data/synthetic."""
    from tbml.extract import extract_document
    from tbml.paths import SYNTHETIC_DIR

    results: list[FieldResult] = []
    for pdf in sorted((SYNTHETIC_DIR / "pdfs").glob("*.pdf")):
        truth = Invoice.model_validate_json(
            (SYNTHETIC_DIR / "truth" / f"{pdf.stem}.json").read_text()
        )
        results += compare(truth, extract_document(pdf).invoice)
    print(report(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
