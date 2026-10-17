"""Printed quantity and price -> benchmark unit and USD (plan 3.9, 3.10).

Never guesses: when a unit cannot be converted with documented data, the result is null and the
note says why.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache

import pandas as pd

from tbml.paths import BENCHMARKS_DIR, REFERENCE_DIR
from tbml.schemas import LineItem

# printed unit -> (dimension, amount in the dimension's base unit: kg, l or pieces)
_SIMPLE_UNITS: dict[str, tuple[str, float]] = {
    **dict.fromkeys(["kg", "kgs", "kilo", "kilos", "kilogram", "kilograms"], ("kg", 1.0)),
    **dict.fromkeys(["g", "gram", "grams"], ("kg", 0.001)),
    **dict.fromkeys(["mt", "t", "tonne", "tonnes", "ton", "tons"], ("kg", 1000.0)),
    **dict.fromkeys(["lb", "lbs", "pound", "pounds"], ("kg", 0.45359237)),
    **dict.fromkeys(["l", "lt", "ltr", "litre", "litres", "liter", "liters"], ("l", 1.0)),
    **dict.fromkeys(["ml"], ("l", 0.001)),
    **dict.fromkeys(["cl"], ("l", 0.01)),
    **dict.fromkeys(
        [
            "pcs",
            "pc",
            "piece",
            "pieces",
            "unit",
            "units",
            "u",
            "each",
            "ea",
            "nos",
            "cans",
            "can",
            "bottle",
            "bottles",
        ],
        ("u", 1.0),
    ),  # fmt: skip
    **dict.fromkeys(["dozen", "doz"], ("u", 12.0)),
    **dict.fromkeys(["pair", "pairs"], ("u", 2.0)),
}
_PACK_UNITS = frozenset(
    ["carton", "cartons", "ctn", "ctns", "box", "boxes", "case", "cases", "pack", "packs"]
)
_BAG_UNITS = frozenset(["bag", "bags", "sack", "sacks"])

_PACK_COUNT = re.compile(r"(?:carton|ctn|box|case|pack|packed)s?\s*(?:of|x|/)\s*([\d,]+)")
_MASS_IN_TEXT = re.compile(r"(\d+(?:\.\d+)?)\s*kg\b")
_VOLUME_IN_TEXT = re.compile(r"(\d+(?:\.\d+)?)\s*(ml|cl|l|litres?|liters?)(?![a-z])")


@dataclass
class Normalised:
    """Result of unit/FX conversion. Quantity, unit and price are None when conversion was not
    possible; `note` always explains the arithmetic (or why there is none) for the report."""

    quantity: float | None
    unit: str | None
    unit_price_usd: float | None
    note: str


@lru_cache(maxsize=1)
def benchmark_units() -> dict[str, str]:
    """hs6 -> benchmark unit, from the real bands when present, else the mock bands."""
    path = BENCHMARKS_DIR / "bands.parquet"
    if not path.exists():
        path = BENCHMARKS_DIR / "bands_mock.parquet"
    bands = pd.read_parquet(path)
    return dict(zip(bands.hs6, bands.unit, strict=True))


@lru_cache(maxsize=1)
def load_fx() -> dict[str, float]:
    """Currency -> units per 1 USD from data/reference/fx.csv."""
    with open(REFERENCE_DIR / "fx.csv", newline="") as f:
        return {r["currency"]: float(r["units_per_usd"]) for r in csv.DictReader(f)}


@lru_cache(maxsize=1)
def load_unit_weights() -> list[dict[str, str]]:
    """Rows of unit_weights.csv: documented kg-per-bag / kg-per-piece factors by HS6."""
    with open(REFERENCE_DIR / "unit_weights.csv", newline="") as f:
        return list(csv.DictReader(f))


def _weight_row(hs6: str, unit: str, text: str) -> dict[str, str] | None:
    """First unit_weights row for this HS6 and unit whose optional text pattern matches the
    description."""
    for row in load_unit_weights():
        if row["hs6"] == hs6 and row["unit"] == unit:
            if not row["pattern"] or re.search(rf"(?<![a-z0-9]){row['pattern']}(?![a-z0-9])", text):
                return row
    return None


def _pack_count(text: str) -> float | None:
    """Pieces per pack from wording like 'carton of 24' or 'box x 100', else None."""
    m = _PACK_COUNT.search(text)
    return float(m.group(1).replace(",", "")) if m else None


def _units_per_printed(
    hs6: str, printed_unit: str, text: str, target: str
) -> tuple[float, str] | tuple[None, str]:
    """Benchmark units in one printed unit, with a human-readable derivation, or (None, why)."""
    unit = printed_unit.strip().lower().rstrip(".")
    pieces: float | None = None  # pieces per printed unit
    piece_desc = ""
    if unit in _SIMPLE_UNITS:
        dim, amount = _SIMPLE_UNITS[unit]
        if dim == target:
            return amount, f"1 {unit} = {amount:g} {target}"
        if dim != "u":
            return None, f"printed unit '{unit}' ({dim}) cannot be converted to {target}"
        pieces, piece_desc = amount, f"1 {unit} = {amount:g} pc"
    elif unit in _PACK_UNITS:
        pieces = _pack_count(text)
        if pieces is None:
            return None, f"printed unit '{unit}' with no pack size in the description"
        piece_desc = f"1 {unit} = {pieces:g} pc (from description)"
    elif unit in _BAG_UNITS:
        if target != "kg":
            return None, f"printed unit '{unit}' cannot be converted to {target}"
        m = _MASS_IN_TEXT.search(text)
        if m:
            kg = float(m.group(1))
            return kg, f"1 {unit} = {kg:g} kg (from description)"
        row = _weight_row(hs6, "bag", text)
        if row:
            return float(
                row["kg_per_unit"]
            ), f"1 {unit} = {row['kg_per_unit']} kg (unit_weights.csv)"
        return None, f"printed unit '{unit}' with no bag weight in the description or table"
    else:
        return None, f"unrecognised printed unit '{printed_unit}'"

    # Here the line is counted in pieces; convert pieces to the benchmark unit.
    if target == "u":
        return pieces, piece_desc
    if target == "kg":
        row = _weight_row(hs6, "piece", text)
        if not row:
            return None, f"no kg-per-piece entry in unit_weights.csv for HS6 {hs6} matching line"
        kg = float(row["kg_per_unit"])
        return pieces * kg, f"{piece_desc}; 1 pc = {kg:g} kg (unit_weights.csv)"
    if target == "l":
        m = _VOLUME_IN_TEXT.search(text)
        if not m:
            return None, "no per-piece volume found in the description"
        value, vunit = float(m.group(1)), m.group(2)
        litres = value * (0.001 if vunit == "ml" else 0.01 if vunit == "cl" else 1.0)
        return pieces * litres, f"{piece_desc}; 1 pc = {litres:g} l (from description)"
    return None, f"unsupported benchmark unit '{target}'"


def normalise(item: LineItem, hs6: str | None, currency: str) -> Normalised:
    """Convert a line to the benchmark unit of its HS6 and to USD per that unit.

    quantity = printed quantity x benchmark units per printed unit; price = printed unit price
    / FX rate / that same factor. Any missing ingredient (HS6, benchmark unit, FX rate, unit
    conversion) returns a Normalised of Nones with the reason in `note`.
    """
    if hs6 is None:
        return Normalised(None, None, None, "not normalised: line has no HS6")
    target = benchmark_units().get(hs6)
    if target is None:
        return Normalised(None, None, None, f"not normalised: no benchmark unit known for {hs6}")
    rate = load_fx().get(currency)
    if rate is None:
        return Normalised(None, target, None, f"not normalised: no FX rate for {currency}")
    per, how = _units_per_printed(hs6, item.unit, item.description.lower(), target)
    if per is None:
        return Normalised(None, target, None, f"not normalised: {how}")

    quantity = round(item.quantity * per, 6)
    price = round(item.unit_price / rate / per, 6)
    fx = "invoice in USD so no FX" if currency == "USD" else f"{rate:g} {currency}/USD"
    note = (
        f"{item.quantity:,g} {item.unit} x {per:g} {target}/{item.unit} ({how}) = {quantity:,g} "
        f"{target}; {fx}; {item.unit_price:,.6g} {currency}/{item.unit} -> "
        f"{price:,.6g} USD/{target}."
    )
    return Normalised(quantity, target, price, note)
