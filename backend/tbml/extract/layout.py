"""Deterministic layout parser for the three known invoice templates (classic / modern / trade).

This is the offline path: used when no LLM is configured, and as the fallback when the LLM output
fails validation twice. It reads positions from the PDF, so wrapped names and addresses and
two-column blocks are separated correctly. It never repairs or recomputes numbers: an arithmetic
error on the invoice must reach the rules engine unchanged (R6).
"""

from __future__ import annotations

import datetime as dt
import re
from dataclasses import dataclass, field

from tbml.extract.address import classify_address
from tbml.extract.countries import UNKNOWN_COUNTRY, country_from_address
from tbml.extract.numbers import parse_number
from tbml.extract.pdftext import RawDocument, RawPage, Word
from tbml.schemas import AddressType, Invoice, LineItem, Party

_MISSING = {"", "-", "—", "n/a", "na", "none", "null"}
_ADDRESS_START = re.compile(
    r"^(\d|no\.|unit|flat|office|warehouse|p\.?o\.? box|plot|suite|building|floor|apt|room|block|"
    r"house|villa|shop|level)",
    re.I,
)


class LayoutError(Exception):
    """The document does not match any known template."""


@dataclass
class ParseResult:
    """An Invoice built by the layout parser, plus the warnings it raised on the way."""

    invoice: Invoice
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- word geometry


def _lines(words: list[Word]) -> list[list[Word]]:
    """Group words into visual lines (same baseline within 3pt), each sorted left to right."""
    out: list[list[Word]] = []
    for w in sorted(words, key=lambda w: (w.top, w.x0)):
        if out and abs(out[-1][0].top - w.top) <= 3:
            out[-1].append(w)
        else:
            out.append([w])
    return [sorted(line, key=lambda w: w.x0) for line in out]


def _region(
    words: list[Word], x0: float, x1: float, y0: float, y1: float, *, bold: bool | None = None
) -> list[Word]:
    """Words whose centre lies in the box [x0, x1) x [y0, y1), optionally only bold/non-bold
    ones."""
    return [
        w for w in words if x0 <= w.xc < x1 and y0 <= w.yc < y1 and (bold is None or w.bold == bold)
    ]


def _text(words: list[Word]) -> str:
    """Words joined into reading-order text, one visual line after another."""
    return " ".join(" ".join(w.text for w in line) for line in _lines(words)).strip()


def _find(words: list[Word], text: str, *, after: float = -1, x_min: float = -1) -> Word | None:
    """First word (top-to-bottom, left-to-right) equal to `text` ignoring case, below `after` and
    right of `x_min`."""
    for w in sorted(words, key=lambda w: (w.top, w.x0)):
        if w.text.upper() == text.upper() and w.top > after and w.x0 >= x_min:
            return w
    return None


def _cells(line: list[Word], gap: float = 12.0) -> list[tuple[str, float]]:
    """Split a label line into (label text, x0) cells wherever the horizontal gap is wide."""
    cells: list[list[Word]] = []
    for w in line:
        if cells and w.x0 - cells[-1][-1].x1 <= gap:
            cells[-1].append(w)
        else:
            cells.append([w])
    return [(" ".join(w.text for w in c), c[0].x0) for c in cells]


def _none_if_missing(text: str | None) -> str | None:
    """Treat '-', 'N/A', 'none' and the like as absent."""
    if text is None:
        return None
    t = text.strip()
    return None if t.lower() in _MISSING else t


# ---------------------------------------------------------------- scalar parsing

_MONTHS = {
    m: i
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1
    )
}


def parse_date(text: str) -> dt.date | None:
    """Parse ISO, DD/MM/YYYY (day first), '3 Mar 2024' and 'March 3, 2024'; None if none match."""
    t = text.strip()
    if m := re.search(r"(\d{4})-(\d{2})-(\d{2})", t):
        return dt.date(int(m[1]), int(m[2]), int(m[3]))
    if m := re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", t):  # DD/MM/YYYY (UK/UAE convention)
        return dt.date(int(m[3]), int(m[2]), int(m[1]))
    if m := re.search(r"(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})", t):
        month = _MONTHS.get(m[2][:3].lower())
        if month:
            return dt.date(int(m[3]), month, int(m[1]))
    if m := re.search(r"([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})", t):
        month = _MONTHS.get(m[1][:3].lower())
        if month:
            return dt.date(int(m[3]), month, int(m[2]))
    return None


def _party(name: str, address: str, warnings: list[str], role: str) -> Party:
    """Build a Party; country from the address (ZZ plus a warning if unreadable), type from
    keywords."""
    country = country_from_address(address)
    if country is None:
        warnings.append(f"{role}: could not read country from address {address!r}")
        country = UNKNOWN_COUNTRY
    kind = classify_address(name, address) or AddressType.unknown
    return Party(name=name, address=address, country=country, address_type=kind)


def _split_party(words: list[Word], *, name_is_bold: bool) -> tuple[str, str]:
    """Split a name+address block. Bold words are the name when the template bolds it; otherwise
    the name is the first line (plus continuation lines until an address-looking line)."""
    lines = _lines(words)
    if not lines:
        return "", ""
    if name_is_bold:
        name_words = [w for line in lines for w in line if w.bold]
        addr_words = [w for line in lines for w in line if not w.bold]
        return _text(name_words), _text(addr_words)
    name_lines = [lines[0]]
    for line in lines[1:]:
        first = " ".join(w.text for w in line)
        prev = " ".join(w.text for w in name_lines[-1])
        if len(prev) >= 40 and not _ADDRESS_START.match(first):
            name_lines.append(line)
        else:
            break
    rest = lines[len(name_lines) :]
    return _text([w for line in name_lines for w in line]), _text(
        [w for line in rest for w in line]
    )


# ---------------------------------------------------------------- table + totals

_NUM = r"-?\d[\d.,]*"
_TAIL = (
    rf"(?P<desc>.*?)\s*(?P<qty>{_NUM})\s+(?P<unit>[^\s\d]\S*)\s+"
    rf"(?P<price>{_NUM})\s+(?P<total>{_NUM})$"
)
_ROW = re.compile(_TAIL)
_ROW_INDEXED = re.compile(rf"^(?P<idx>\d+)\s+{_TAIL}")
_HEADER = re.compile(r"\b(description|item)\b.*\b(qty|quantity)\b", re.I)
_TOTAL_LINE = re.compile(r"^\s*(grand\s+)?total\b|^\s*amount\s+due\b", re.I)
_CCY_ONLY = re.compile(r"^\(?[A-Z]{3}\)?$")


def _parse_items(pages: list[RawPage], warnings: list[str]) -> tuple[list[LineItem], str | None]:
    """Line items read from positioned text lines (pdfplumber's table finder is unreliable on
    these layouts). Rows are matched from the right: qty, unit, unit price, line total. A
    description that wraps is stitched back: text above a numbers-only line is its first part,
    text below a row is its tail."""
    rows: list[dict] = []
    currency: str | None = None
    in_table = indexed = False
    buffer: list[str] = []

    def flush_to_previous(parts: list[str]) -> None:
        """Append wrapped description text to the previous row."""
        if parts and rows:
            rows[-1]["desc"] = " ".join([rows[-1]["desc"], *parts]).strip()

    done = False
    for page in pages:
        for line in _lines(page.words):
            text = " ".join(w.text for w in line)
            if _HEADER.search(text):
                in_table, indexed = True, bool(re.match(r"^(#|no\.)", text, re.I))
                if currency is None and (m := re.search(r"\(([A-Z]{3})\)", text)):
                    currency = m[1]
                continue
            if not in_table:
                continue
            if _TOTAL_LINE.match(text):
                done = True
                break
            if _CCY_ONLY.match(text):  # second line of a wrapped column header
                currency = currency or text.strip("()")
                continue
            m = (_ROW_INDEXED if indexed else _ROW).match(text)
            if not m:
                if not text.upper().startswith("SYNTHETIC"):
                    buffer.append(text)
                continue
            desc = m["desc"].strip()
            if desc:
                flush_to_previous(buffer)
                buffer = []
                open_row = False
            else:
                cut = len(buffer) // 2 if rows and rows[-1]["open"] else 0
                flush_to_previous(buffer[:cut])
                desc, buffer, open_row = " ".join(buffer[cut:]), [], True
            rows.append({"desc": desc, "m": m, "open": open_row})
        if done:
            break
    flush_to_previous(buffer)

    items: list[LineItem] = []
    for row in rows:
        m = row["m"]
        line_id = f"L{len(items) + 1}"
        conf = 1.0
        values: dict[str, float] = {}
        for key in ("qty", "price", "total"):
            v, repaired = parse_number(m[key])
            if v is None:
                warnings.append(f"{line_id}: could not read {key} from {m[key]!r}")
                conf, v = min(conf, 0.3), 0.0
            elif repaired:
                conf = min(conf, 0.7)
            values[key] = v
        if not row["desc"]:
            conf = min(conf, 0.6)
        items.append(
            LineItem(
                line_id=line_id,
                description=row["desc"],
                quantity=values["qty"],
                unit=m["unit"],
                unit_price=values["price"],
                line_total=values["total"],
                extraction_confidence=conf,
            )
        )
    return items, currency


def _stated_total(text: str, warnings: list[str]) -> tuple[float, str | None]:
    """The last 'Total' / 'Amount due' line as (value, currency or None); 0.0 plus a warning if
    absent."""
    pattern = re.compile(
        r"^\s*(?:grand\s+)?(?:total[^\n\d]*?|amount\s+due:?)\s*([A-Z]{3})?\s*(-?[\d.,]*\d)\s*([A-Z]{3})?\s*$",
        re.I | re.M,
    )
    matches = list(pattern.finditer(text))
    if not matches:
        warnings.append("stated total not found")
        return 0.0, None
    m = matches[-1]
    value, _ = parse_number(m[2])
    ccy = (m[1] or m[3] or "").upper() or None
    if value is None:
        warnings.append(f"stated total unreadable: {m[2]!r}")
        return 0.0, ccy
    return value, ccy


# ---------------------------------------------------------------- templates


def _detect(text: str) -> str:
    """Name the template from its anchor labels; LayoutError if it is none of the three."""
    up = text.upper()
    if "SHIPPER / EXPORTER" in up:
        return "trade"
    if "BILL TO" in up and "SHIP TO" in up:
        return "modern"
    if "SELLER" in up and "CONSIGNEE" in up and "COUNTRY OF ORIGIN" in up:
        return "classic"
    raise LayoutError("unrecognised invoice layout")


def _consignee(
    text: str, words: list[Word], buyer: Party, warnings: list[str], *, name_is_bold: bool
) -> Party | None:
    """The ship-to party, or None when the invoice says it is the same as the buyer (or is
    empty)."""
    if re.search(r"same as (buyer|bill)|as billing address|as buyer", text, re.I) or not text:
        return None
    name, address = _split_party(words, name_is_bold=name_is_bold)
    if not name:
        return None
    return _party(name, address, warnings, "consignee")


def _parse_classic(page: RawPage, w: list[Word], warnings: list[str]) -> dict:
    """Template with SELLER / BUYER / CONSIGNEE blocks and an INVOICE panel on the right."""
    seller_l = _find(w, "SELLER")
    buyer_l = _find(w, "BUYER")
    cons_l = _find(w, "CONSIGNEE")
    country_l = _find(w, "COUNTRY", after=buyer_l.top if buyer_l else 0)
    inv_l = next(
        (x for x in w if x.text == "INVOICE" and x.x0 > page.width / 2 - 40 and x.top > 80), None
    )
    if not (seller_l and buyer_l and cons_l and country_l and inv_l):
        raise LayoutError("classic: missing anchor labels")
    right = _text(_region(w, inv_l.x0 - 2, 9999, inv_l.top - 2, buyer_l.top - 2))
    seller = _split_party(
        _region(w, seller_l.x0, inv_l.x0 - 2, seller_l.bottom, buyer_l.top - 2), name_is_bold=True
    )
    buyer_words = _region(w, buyer_l.x0, cons_l.x0 - 2, buyer_l.bottom, country_l.top - 2)
    cons_words = _region(w, cons_l.x0 - 2, 9999, cons_l.bottom, country_l.top - 2)
    below = _lines(_region(w, 0, 9999, country_l.top - 2, 99999))

    def after_label(label: str) -> str | None:
        """Text following a label on a line below the party blocks (origin, ports)."""
        for line in below:
            t = " ".join(x.text for x in line)
            if t.upper().startswith(label):
                return _none_if_missing(t[len(label) :])
        return None

    def right_field(label: str, pattern: str) -> str | None:
        """Value of a 'LABEL value' pair in the right-hand INVOICE panel."""
        m = re.search(rf"{label}\s*({pattern})", right, re.I)
        return m[1] if m else None

    return {
        "invoice_id": right_field(r"INVOICE\s+NO\.?", r"\S+"),
        "date_text": right_field(r"DATE", r".+?(?=\s+INCOTERMS|\s+CURRENCY|$)"),
        "incoterm": _none_if_missing(right_field(r"INCOTERMS?", r"\S+")),
        "currency": right_field(r"CURRENCY", r"[A-Z]{3}"),
        "seller": seller,
        "buyer": _split_party(buyer_words, name_is_bold=True),
        "consignee_text": _text(cons_words),
        "consignee_words": cons_words,
        "consignee_bold": True,
        "origin": after_label("COUNTRY OF ORIGIN"),
        "loading": after_label("PORT OF LOADING"),
        "discharge": after_label("PORT OF DISCHARGE"),
    }


def _parse_modern(page: RawPage, w: list[Word], warnings: list[str]) -> dict:
    """Template with BILL TO / SHIP TO blocks and a labelled details strip."""
    bill_l = _find(w, "BILL")
    ship_l = _find(w, "SHIP")
    origin_l = _find(w, "ORIGIN")
    terms_l = _find(w, "TERMS")
    if not (bill_l and ship_l and origin_l and terms_l):
        raise LayoutError("modern: missing anchor labels")
    title = next((x for x in w if x.text == "INVOICE" and x.x0 > page.width / 2), None)
    seller_x1 = title.x0 - 4 if title else 9999
    seller = _split_party(_region(w, 0, seller_x1, 0, bill_l.top - 2), name_is_bold=True)
    top_right = _text(_region(w, page.width / 2, 9999, 0, bill_l.top - 2))

    item_l = _find(w, "ITEM", after=terms_l.top)
    table_top = item_l.top - 2 if item_l else 99999
    labels = [x for x in w if x.size <= 8.3 and x.top >= origin_l.top - 2 and x.top < table_top]
    label_lines = _lines(labels)
    fields: dict[str, str] = {}
    for li, line in enumerate(label_lines):
        cells = _cells(line)
        y1 = label_lines[li + 1][0].top - 2 if li + 1 < len(label_lines) else table_top
        for i, (label, x0) in enumerate(cells):
            x1 = cells[i + 1][1] - 3 if i + 1 < len(cells) else 9999
            values = [v for v in _region(w, x0 - 3, x1, line[0].bottom, y1) if v.size > 8.3]
            fields[label.upper()] = _text(values)
    loc, terms = fields, fields
    m_id = re.search(r"#\s*(\S+)", top_right)
    m_date = re.search(r"(?:issued|date)[:\s]*(.+)$", top_right, re.I)
    return {
        "invoice_id": m_id[1] if m_id else None,
        "date_text": m_date[1] if m_date else None,
        "incoterm": _none_if_missing(terms.get("TERMS")),
        "currency": terms.get("CURRENCY"),
        "seller": seller,
        "buyer": _split_party(
            _region(w, bill_l.x0, ship_l.x0 - 2, bill_l.bottom, origin_l.top - 2),
            name_is_bold=True,
        ),
        "consignee_text": _text(_region(w, ship_l.x0 - 2, 9999, ship_l.bottom, origin_l.top - 2)),
        "consignee_words": _region(w, ship_l.x0 - 2, 9999, ship_l.bottom, origin_l.top - 2),
        "consignee_bold": True,
        "origin": _none_if_missing(loc.get("ORIGIN")),
        "loading": _none_if_missing(loc.get("LOADING")),
        "discharge": _none_if_missing(loc.get("DESTINATION PORT") or loc.get("DESTINATION")),
    }


def _parse_trade(page: RawPage, w: list[Word], warnings: list[str]) -> dict:
    """Template laid out as numbered boxes (1. Shipper / Exporter, ...), like a customs form."""
    markers = [x for x in w if re.fullmatch(r"\d\.", x.text) and x.bold and x.x0 < page.width]
    if not markers:
        raise LayoutError("trade: no numbered boxes")
    stop = _find(w, "DESCRIPTION")
    stop_y = stop.top - 4 if stop else 99999
    columns = sorted({round(m.x0) for m in markers})

    def box(n: int) -> list[Word]:
        """Non-bold words inside numbered box `n`, bounded by the next box and the item table."""
        m = next((x for x in markers if x.text == f"{n}."), None)
        if m is None:
            return []
        col = round(m.x0)
        nxt_col = next((c for c in columns if c > col + 5), 9999)
        below = [x for x in markers if abs(round(x.x0) - col) <= 5 and x.top > m.top + 1]
        y1 = min([x.top for x in below] + [stop_y])
        # values are the non-bold words below the label line
        label_bottom = max(
            (x.bottom for x in w if x.bold and abs(x.top - m.top) <= 3), default=m.bottom
        )
        return _region(w, col - 2, nxt_col - 2, label_bottom, y1, bold=False)

    inv = _text(box(2))
    m_id = re.match(r"(\S+)", inv)
    t3 = _text(box(3))
    m_ccy = re.search(r"CURRENCY:?\s*([A-Z]{3})", t3, re.I)
    m_term = re.match(r"([A-Za-z]{3})\s+CURRENCY", t3, re.I)
    ports = _text(box(7))
    loading, _, discharge = ports.partition(" / ")
    return {
        "invoice_id": m_id[1] if m_id else None,
        "date_text": inv,
        "incoterm": m_term[1].upper() if m_term else None,
        "currency": m_ccy[1].upper() if m_ccy else None,
        "seller": _split_party(box(1), name_is_bold=False),
        "buyer": _split_party(box(5), name_is_bold=False),
        "consignee_text": _text(box(4)),
        "consignee_words": box(4),
        "consignee_bold": False,
        "origin": _none_if_missing(_text(box(6))),
        "loading": _none_if_missing(loading),
        "discharge": _none_if_missing(discharge),
    }


_PARSERS = {"classic": _parse_classic, "modern": _parse_modern, "trade": _parse_trade}


def parse_layout(doc: RawDocument) -> ParseResult:
    """Parse a document with the layout parser. Raises LayoutError for unknown templates."""
    if not doc.has_text:
        raise LayoutError("no text layer (scanned PDF?)")
    warnings: list[str] = []
    template = _detect(doc.text)
    page = doc.pages[0]
    f = _PARSERS[template](page, page.words, warnings)

    for key in ("invoice_id", "date_text", "currency"):
        if not f.get(key):
            raise LayoutError(f"{template}: could not read {key}")
    items, table_ccy = _parse_items(doc.pages, warnings)
    total, total_ccy = _stated_total(doc.text, warnings)
    if not items:
        warnings.append("no line items found")
    date = parse_date(f["date_text"])
    if date is None:
        raise LayoutError(f"{template}: unreadable date {f['date_text']!r}")

    seller = _party(*f["seller"], warnings, "seller")
    buyer = _party(*f["buyer"], warnings, "buyer")
    consignee = _consignee(
        f["consignee_text"], f["consignee_words"], buyer, warnings, name_is_bold=f["consignee_bold"]
    )
    currency = (f["currency"] or table_ccy or total_ccy or "XXX").upper()
    invoice = Invoice(
        invoice_id=f["invoice_id"],
        invoice_date=date,
        seller=seller,
        buyer=buyer,
        consignee=consignee,
        country_of_origin=f["origin"],
        port_of_loading=f["loading"],
        port_of_discharge=f["discharge"],
        incoterm=f["incoterm"],
        currency=currency,
        line_items=items,
        stated_total=total,
        source_file=doc.path.name,
        is_synthetic="SYNTHETIC TEST DOCUMENT" in doc.text.upper(),
    )
    return ParseResult(invoice, warnings)
