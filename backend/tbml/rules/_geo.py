"""Place-name lookups for R4/R5: country names and aliases, and a city -> country gazetteer.

Data: data/reference/countries.csv and data/reference/cities.csv (about 600 trade cities and ports).
"""

from __future__ import annotations

import csv
import re
import unicodedata
from functools import lru_cache

from tbml.paths import REFERENCE_DIR


def normalise(text: str) -> str:
    """Lower-case, accent-free, punctuation-free, single-spaced: 'Plzeň, U.K.' -> 'plzen u k'."""
    decomposed = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return " ".join(re.sub(r"[^a-z0-9]+", " ", stripped.lower()).split())


def strip_parentheses(text: str) -> str:
    """Drop '(...)' asides, e.g. 'Shenzhen (Yantian), China' -> 'Shenzhen , China'."""
    return re.sub(r"\([^)]*\)", " ", text)


@lru_cache(maxsize=1)
def _tables() -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    names: dict[str, str] = {}  # iso -> display name
    country_keys: dict[str, str] = {}  # normalised name/alias -> iso
    with open(REFERENCE_DIR / "countries.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            names[row["iso2"]] = row["name"]
            for label in [row["name"], *filter(None, row["aliases"].split(";"))]:
                country_keys[normalise(label)] = row["iso2"]
    city_keys: dict[str, str] = {}  # normalised city -> iso
    city_display: dict[str, str] = {}
    with open(REFERENCE_DIR / "cities.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            key = normalise(row["city"])
            if key in country_keys:  # 'Singapore', 'Hong Kong': treat as a country, not a city
                continue
            city_keys[key] = row["country"]
            city_display[key] = row["city"]
    return names, country_keys, city_keys, city_display


def _compile(keys: dict[str, str]) -> re.Pattern[str]:
    ordered = sorted(keys, key=len, reverse=True)  # longest first so 'new york' beats 'york'
    return re.compile(
        r"(?<![a-z0-9])(" + "|".join(re.escape(k) for k in ordered) + r")(?![a-z0-9])"
    )


@lru_cache(maxsize=1)
def _patterns() -> tuple[re.Pattern[str], re.Pattern[str]]:
    _, country_keys, city_keys, _ = _tables()
    return _compile(country_keys), _compile(city_keys)


def country_name(iso: str) -> str:
    return _tables()[0].get(iso, iso)


def find_countries(text: str) -> list[str]:
    """ISO codes of countries named in `text`, in order of first appearance, no repeats."""
    _, country_keys, _, _ = _tables()
    found: list[str] = []
    for m in _patterns()[0].finditer(normalise(text)):
        iso = country_keys[m.group(1)]
        if iso not in found:
            found.append(iso)
    return found


def find_cities(text: str) -> list[tuple[str, str]]:
    """(city display name, ISO) for each gazetteer city named in `text`, in order of appearance."""
    _, _, city_keys, city_display = _tables()
    found: list[tuple[str, str]] = []
    for m in _patterns()[1].finditer(normalise(text)):
        entry = (city_display[m.group(1)], city_keys[m.group(1)])
        if entry not in found:
            found.append(entry)
    return found


def place_country(text: str) -> str | None:
    """The country a place string points at: a named country first, else the first known city's."""
    countries = find_countries(strip_parentheses(text))
    if countries:
        return countries[0]
    cities = find_cities(strip_parentheses(text))
    return cities[0][1] if cities else None
