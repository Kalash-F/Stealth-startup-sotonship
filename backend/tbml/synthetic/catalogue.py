"""Static vocabulary for the synthetic invoice generator: products, routes, places, names.

Everything here is invented for testing. Company names, street names and postcodes are
fictional; city and port names are real so geography rules have something to check.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Variant:
    """One way a commodity appears on an invoice line."""

    description: str
    unit: str  # unit as printed on the invoice
    bench_per_unit: float  # benchmark units (kg / l / u) in one printed unit
    qty_range: tuple[int, int]  # typical clean quantity, in printed units
    qty_decimals: int = 0


@dataclass(frozen=True)
class Commodity:
    hs6: str
    name: str
    benchmark_unit: str
    variants: tuple[Variant, ...]


# Benchmark units follow the usual Comtrade quantity unit per HS6 (kg, l, u = items).
# Weights per piece are rough typical values; Phase 3 owns the authoritative unit_weights.csv.
COMMODITIES: dict[str, Commodity] = {
    c.hs6: c
    for c in [
        Commodity(
            "731815",
            "screws and bolts",
            "kg",
            (
                Variant("M6 x 30mm hex bolts, zinc plated", "pcs", 0.009, (50_000, 500_000)),
                Variant(
                    "Stainless steel machine screws M4 x 12mm", "pcs", 0.003, (100_000, 900_000)
                ),
                Variant("Hex head bolts M6, carton of 1,000 pcs", "cartons", 9.0, (50, 600)),
                Variant("Carriage bolts M10 x 100mm, galvanised steel", "kg", 1.0, (500, 8_000)),
            ),
        ),
        Commodity(
            "220210",
            "flavoured and sweetened waters",
            "l",
            (
                Variant(
                    "Energy drink 250ml cans, original flavour", "cans", 0.25, (20_000, 200_000)
                ),
                Variant(
                    "Sparkling flavoured water 500ml PET bottles", "bottles", 0.5, (10_000, 120_000)
                ),
                Variant(
                    "Lemon soft drink 330ml cans, carton of 24", "cartons", 7.92, (1_000, 8_000)
                ),
            ),
        ),
        Commodity(
            "852351",
            "USB flash drives",
            "u",
            (
                Variant("USB 3.0 flash drive 64GB, metal casing", "pcs", 1.0, (2_000, 40_000)),
                Variant("USB-C flash drive 128GB with keyring", "pcs", 1.0, (1_000, 25_000)),
                Variant("USB 2.0 memory stick 32GB, carton of 100", "cartons", 100.0, (20, 300)),
            ),
        ),
        Commodity(
            "610910",
            "cotton T-shirts",
            "u",
            (
                Variant(
                    "Men's crew-neck T-shirt, 100% cotton jersey knit", "pcs", 1.0, (2_000, 50_000)
                ),
                Variant(
                    "Women's V-neck T-shirt, cotton knitted, assorted sizes",
                    "pcs",
                    1.0,
                    (2_000, 40_000),
                ),
                Variant(
                    "Plain white cotton T-shirts, packed per dozen", "dozen", 12.0, (200, 3_000)
                ),
            ),
        ),
        Commodity(
            "090111",
            "green coffee",
            "kg",
            (
                Variant(
                    "Green Arabica coffee beans, unroasted, not decaffeinated",
                    "kg",
                    1.0,
                    (5_000, 40_000),
                ),
                Variant("Robusta green coffee beans, 60kg jute bags", "bags", 60.0, (100, 600)),
                Variant(
                    "Unroasted Arabica coffee, washed, screen 17/18", "MT", 1000.0, (10, 40), 1
                ),
            ),
        ),
        Commodity(
            "740311",
            "refined copper cathodes",
            "kg",
            (
                Variant("Copper cathodes Grade A, 99.99% Cu", "MT", 1000.0, (20, 200), 1),
                Variant("Refined copper cathode sheets, LME Grade A", "kg", 1.0, (20_000, 150_000)),
            ),
        ),
        Commodity(
            "847130",
            "laptops",
            "u",
            (
                Variant(
                    "14-inch laptop computer, Intel Core i5, 16GB RAM, 512GB SSD",
                    "pcs",
                    1.0,
                    (50, 1_500),
                ),
                Variant("15.6-inch notebook PC, AMD Ryzen 7, 16GB RAM", "units", 1.0, (50, 1_200)),
                Variant(
                    "13-inch ultraportable laptop, 8GB RAM, 256GB SSD", "pcs", 1.0, (100, 2_000)
                ),
            ),
        ),
    ]
}

# Exchange-traded commodities whose price is roughly the same everywhere; shipping them at a
# premium has no economic logic (ROUTE_NO_ECONOMIC_SENSE). Re-check against per-route bands
# once Phase 3 lands.
PARITY_HS6 = ("740311", "090111")

ROUTES = ("CN-GB", "AE-GB", "GB-AE", "AE-CZ")

ROUTE_CURRENCIES = {
    "CN-GB": ("USD", "USD", "GBP", "CNY"),
    "AE-GB": ("USD", "AED", "GBP"),
    "GB-AE": ("GBP", "USD", "AED"),
    "AE-CZ": ("EUR", "USD", "AED"),
}

INCOTERMS = ("FOB", "CIF", "CFR", "EXW", "DAP", "FCA")

COUNTRY_NAMES = {
    "CN": ("China", "People's Republic of China", "Made in China", "P.R. China"),
    "GB": ("United Kingdom", "UK", "Great Britain", "Made in the UK"),
    "AE": ("United Arab Emirates", "UAE", "U.A.E."),
    "CZ": ("Czech Republic", "Czechia"),
}
COUNTRY_LABEL = {
    "CN": "China",
    "GB": "United Kingdom",
    "AE": "United Arab Emirates",
    "CZ": "Czech Republic",
}

CITIES = {
    "CN": ("Shanghai", "Ningbo", "Shenzhen", "Guangzhou", "Qingdao", "Xiamen"),
    "GB": ("Leeds", "Manchester", "Birmingham", "Bristol", "Glasgow", "Leicester"),
    "AE": ("Dubai", "Sharjah", "Abu Dhabi", "Ajman"),
    "CZ": ("Prague", "Brno", "Ostrava", "Plzeň"),
}

# Postcode area per UK city, so invented postcodes still agree with the city they sit in.
GB_POSTCODE_AREA = {
    "Leeds": "LS",
    "Manchester": "M",
    "Birmingham": "B",
    "Bristol": "BS",
    "Glasgow": "G",
    "Leicester": "LE",
}

PORTS_OF_LOADING = {
    "CN": ("Shanghai, China", "Ningbo, China", "Shenzhen (Yantian), China", "Qingdao, China"),
    "GB": ("Felixstowe, United Kingdom", "Southampton, United Kingdom", "London Gateway, UK"),
    "AE": ("Jebel Ali, Dubai, UAE", "Khalifa Port, Abu Dhabi, UAE", "Port Khalid, Sharjah, UAE"),
}
PORTS_OF_DISCHARGE = {
    "GB": ("Felixstowe, United Kingdom", "Southampton, United Kingdom", "London Gateway, UK"),
    "AE": ("Jebel Ali, Dubai, UAE", "Khalifa Port, Abu Dhabi, UAE"),
    "CZ": ("Hamburg, Germany (final destination Czech Republic)", "Prague Ruzyně Airport, Czechia"),
}

# Third countries used as unexplained origins (GEO_INCONSISTENT) or explained re-export origins.
OTHER_ORIGINS = ("Vietnam", "India", "Turkey", "Malaysia", "Brazil", "Bangladesh", "Indonesia")

# --- company names -------------------------------------------------------------------------
NAME_STEMS = (
    "Harbourline", "Kestrel", "Jinhai", "Ruifeng", "Golden Crane", "Bluewave", "Hengtai",
    "Starbridge", "Longmen", "Silverfern", "Northgate", "Al Rimal", "Saffron Dune", "Oasis Arc",
    "Falconcrest", "Pearl Gulf", "Vltava", "Moravia Line", "Bohemka", "Redwell", "Thornbury",
    "Ashcombe", "Copperleaf", "Meridian Bay", "Tidewater", "Brightmoor", "Eastwind", "Sunmark",
)  # fmt: skip
NAME_TRADES = (
    "Trading", "Industrial", "Import & Export", "Supply", "Commodities", "Distribution",
    "Global Sourcing", "Wholesale", "Logistics", "Merchants",
)  # fmt: skip
COMPANY_SUFFIX = {
    "CN": ("Co., Ltd.", "Industrial Co., Ltd.", "International Trading Co., Ltd."),
    "GB": ("Ltd", "Limited", "UK Ltd"),
    "AE": ("FZE", "LLC", "General Trading LLC", "FZCO"),
    "CZ": ("s.r.o.", "a.s."),
}
PERSON_NAMES = (
    "J. Okafor", "M. Lindqvist", "S. Haddad", "L. Wen", "R. Patel", "T. Novák", "A. Brennan",
    "K. Al Mansoori", "H. Zhou", "E. Dvořák",
)  # fmt: skip

# --- address parts (invented) --------------------------------------------------------------
STREET_NAMES = (
    "Brookfield", "Riverside", "Larkspur", "Copperfield", "Westmere", "Kingfisher", "Ashgrove",
    "Millbrook", "Harrowdene", "Fernhill", "Juniper", "Oakhurst",
)  # fmt: skip
CN_STREETS = ("Xinghai", "Jinqiao", "Haitang", "Fuyuan", "Changjiang", "Minsheng", "Taihe")
CN_DISTRICTS = {
    "Shanghai": "Pudong New Area",
    "Ningbo": "Beilun District",
    "Shenzhen": "Bao'an District",
    "Guangzhou": "Huangpu District",
    "Qingdao": "Huangdao District",
    "Xiamen": "Haicang District",
}
AE_AREAS = ("Al Quoz Industrial Area 3", "Al Qusais", "Musaffah", "Ras Al Khor")
AE_TOWERS = ("Marina Crest Tower", "Al Nahda Residence", "Palm View Heights", "Creekside Tower")
CZ_STREETS = ("Průmyslová", "Lipová", "Nádražní", "Skladová", "Polní", "Zahradní")

# Placeholder descriptions (PLACEHOLDER_DESC), modelled on the HMRC TBML handbook case study.
PLACEHOLDER_DESCRIPTIONS = (
    "Product ABC",
    "Goods as per contract",
    "Item 1",
    "Various",
    "Misc goods",
    "Product XYZ",
    "Goods as per proforma invoice",
    "Item 3",
    "Merchandise",
)
