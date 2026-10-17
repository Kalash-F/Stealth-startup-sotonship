"""Number parsing for invoice text. Reports when the text needed repair."""

import re

_CLEAN = re.compile(r"^-?(\d{1,3}(,\d{3})*|\d+)(\.\d+)?$")
_THOUSANDS_COMMA = re.compile(r"^\d{1,3}(,\d{3})+$")
_THOUSANDS_DOT = re.compile(r"^\d{1,3}(\.\d{3}){2,}$")
_TOKEN = re.compile(r"-?\d[\d,.  ]*\d|-?\d")


def parse_number(text: str) -> tuple[float | None, bool]:
    """Return (value, repaired). `repaired` is True when the text was not a plain number
    (stray characters stripped, or a European-style separator had to be interpreted)."""
    raw = text.strip().replace(" ", " ")
    if _CLEAN.match(raw):
        return float(raw.replace(",", "")), False
    s = re.sub(r"[^\d.,\-]", "", raw)
    if not re.search(r"\d", s):
        return None, True
    if "," in s and "." in s:
        dec = "," if s.rfind(",") > s.rfind(".") else "."
        thou = "." if dec == "," else ","
        s = s.replace(thou, "").replace(dec, ".")
    elif "," in s:
        s = s.replace(",", "") if _THOUSANDS_COMMA.match(s.lstrip("-")) else s.replace(",", ".")
    elif "." in s and _THOUSANDS_DOT.match(s.lstrip("-")):
        s = s.replace(".", "")
    try:
        return float(s), True
    except ValueError:
        return None, True


def numbers_in(text: str) -> set[float]:
    """Every numeric token in `text`, parsed (to check extracted values appear in the document)."""
    found: set[float] = set()
    for m in _TOKEN.finditer(text):
        value, _ = parse_number(m.group(0))
        if value is not None:
            found.add(value)
        # "1,250 kg" style tokens swallow trailing separators; also try the pieces
        for piece in re.split(r"[  ]+", m.group(0)):
            v2, _ = parse_number(piece)
            if v2 is not None:
                found.add(v2)
    return found


def appears_in(value: float, found: set[float]) -> bool:
    """True if `value` equals one of the numbers found in the document (to a relative 1e-9)."""
    return any(abs(value - f) <= max(1e-9, abs(value) * 1e-9) for f in found)
