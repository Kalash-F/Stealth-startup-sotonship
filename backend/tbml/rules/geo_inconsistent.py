"""R4 GEO_INCONSISTENT: the country-of-origin text against the city gazetteer and the port of loading."""

from __future__ import annotations

from tbml.rules._common import config, make_flag
from tbml.rules._geo import (
    country_name,
    find_cities,
    find_countries,
    normalise,
    place_country,
    strip_parentheses,
)
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule, Severity


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    origin = invoice.country_of_origin
    if not origin or not origin.strip():
        return []
    cfg = config("geo_inconsistent")
    lowered = origin.lower()
    if any(phrase in lowered for phrase in cfg["explained_phrases"]):
        return []  # the invoice itself explains a re-export or transhipment (DECISIONS D1.8)

    text = strip_parentheses(origin)
    countries = find_countries(text)
    cities = find_cities(text)

    if countries:
        for city, city_cc in cities:
            if city_cc not in countries:
                named = " / ".join(country_name(c) for c in countries)
                reason = (
                    f'The country of origin is given as "{origin}", but {city} is in '
                    f"{country_name(city_cc)}, not {named}. The place and the country do not match."
                )
                return [
                    make_flag(
                        Rule.GEO_INCONSISTENT,
                        None,
                        Severity.high,
                        reason,
                        {
                            "country_of_origin_text": origin,
                            "city": city,
                            "city_country": city_cc,
                            "stated_countries": countries,
                            "check": "city_vs_country",
                        },
                        expected=f"{city} is in {country_name(city_cc)}",
                        stated=origin,
                    )
                ]

    origin_cc = countries[0] if countries else (cities[0][1] if cities else None)
    if origin_cc is None:
        return []
    loading_cc = place_country(invoice.port_of_loading) if invoice.port_of_loading else None
    if loading_cc is not None:
        reference, basis = loading_cc, f"the port of loading ({invoice.port_of_loading})"
    else:
        reference, basis = invoice.seller.country, "the seller's country"
    if origin_cc == reference:
        return []
    declared = country_name(origin_cc)
    if normalise(origin) != normalise(declared):
        declared += f' ("{origin}")'
    reason = (
        f"The goods are declared as originating in {declared}, but they are loaded "
        f"in {country_name(reference)} according to {basis}. The invoice gives no explanation, such as a "
        f"re-export or transhipment, for the difference."
    )
    return [
        make_flag(
            Rule.GEO_INCONSISTENT,
            None,
            Severity.medium,
            reason,
            {
                "country_of_origin_text": origin,
                "origin_country": origin_cc,
                "port_of_loading": invoice.port_of_loading,
                "reference_country": reference,
                "reference_basis": "port_of_loading"
                if loading_cc is not None
                else "seller_country",
                "check": "origin_vs_loading",
            },
            expected=f"origin in {country_name(reference)}",
            stated=f"origin in {country_name(origin_cc)}",
        )
    ]
