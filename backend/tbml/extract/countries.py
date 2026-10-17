"""Country name -> ISO-3166 alpha-2, for the countries seen on invoices (extend as needed)."""

import re

_NAMES: dict[str, tuple[str, ...]] = {
    "CN": ("china", "p.r. china", "prc", "people's republic of china", "made in china"),
    "GB": (
        "united kingdom",
        "uk",
        "u.k.",
        "great britain",
        "gb",
        "england",
        "scotland",
        "wales",
        "made in the uk",
    ),
    "AE": ("united arab emirates", "uae", "u.a.e.", "emirates"),
    "CZ": ("czech republic", "czechia", "cz"),
    "DE": ("germany", "deutschland"),
    "IN": ("india",),
    "US": ("united states", "usa", "u.s.a.", "united states of america"),
    "TR": ("turkey", "türkiye", "turkiye"),
    "VN": ("vietnam", "viet nam"),
    "BD": ("bangladesh",),
    "ID": ("indonesia",),
    "MY": ("malaysia",),
    "CO": ("colombia",),
    "BR": ("brazil",),
    "ET": ("ethiopia",),
    "NL": ("netherlands", "the netherlands"),
    "FR": ("france",),
    "IT": ("italy",),
    "ES": ("spain",),
    "PL": ("poland",),
    "HK": ("hong kong",),
    "SG": ("singapore",),
    "JP": ("japan",),
    "KR": ("south korea", "korea"),
    "PK": ("pakistan",),
    "SA": ("saudi arabia",),
    "EG": ("egypt",),
    "ZA": ("south africa",),
    "KE": ("kenya",),
}


def _key(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower().replace(".", "")).strip(" ,")


_LOOKUP = {_key(name): iso for iso, names in _NAMES.items() for name in names}
UNKNOWN_COUNTRY = "ZZ"  # ISO 3166 user-assigned code; used when the country cannot be read


def country_code(text: str | None) -> str | None:
    """ISO code for a country name, or None. Accepts 'Made in China', 'China (re-exported ...)'."""
    if not text:
        return None
    t = _key(text)
    if t in _LOOKUP:
        return _LOOKUP[t]
    if re.fullmatch(r"[A-Z]{2}", text.strip()):
        return text.strip()
    return None


def country_from_address(address: str) -> str | None:
    """Country of an address: the last comma-separated segment, else any country name at the end."""
    parts = [p.strip() for p in address.split(",") if p.strip()]
    if parts:
        code = country_code(parts[-1])
        if code:
            return code
    low = _key(address)
    for name in sorted(_LOOKUP, key=len, reverse=True):
        if len(name) > 3 and low.endswith(name):
            return _LOOKUP[name]
    return None
