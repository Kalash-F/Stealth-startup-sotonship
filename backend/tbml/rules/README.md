# rules: red-flag checks R1 to R8

Each rule is one file with a `check(invoice, enriched, benchmarks, warnings) -> list[Flag]` function. `run_rules_with_warnings` (in `__init__.py`) runs all eight in order, collects any skip warnings and sorts flags worst-first, keeping rule order and line order within a severity. `run_rules` returns only the flags. Every threshold, word list and scoring weight is in `config.yaml`; no rule hard-codes a number.

| Code | File | Flags | Severity |
|---|---|---|---|
| R1 `PRICE_OUTLIER` | `price_outlier.py` | Unit price outside the benchmark p10 to p90 band | Medium; high when more than one band-width from the median on a log scale |
| R2 `QTY_VALUE_IMPLAUSIBLE` | `qty_value_implausible.py` | Line worth far more than its quantity could be (over 10 times p90 per unit); or an invoice whose average line value is huge | Medium; high at 10 times over the ceiling |
| R3 `PLACEHOLDER_DESC` | `placeholder_desc.py` | Vague descriptions ("various", "Product ABC", very short and unclassifiable) | Medium; high if also unclassified |
| R4 `GEO_INCONSISTENT` | `geo_inconsistent.py` | Origin text that names a city in another country, or an origin different from the loading port or seller country without a re-export explanation | High for city versus country, medium for origin versus loading |
| R5 `ROUTE_NO_ECONOMIC_SENSE` | `route_no_economic_sense.py` | Price above p75 for a good that costs about the same at both ends of the route | Medium |
| R6 `ARITHMETIC_ERROR` | `arithmetic_error.py` | Quantity times price differs from the line total, or the lines differ from the stated total | Medium; high at 10 percent or more |
| R7 `RESIDENTIAL_CONSIGNEE` | `residential_consignee.py` | Large invoice delivered to a private residence | Medium; high for a consignee above the high threshold |
| R8 `LOW_CONFIDENCE` | `low_confidence.py` | Extraction or classification confidence below 0.5 | Low |

## Shared helpers

- `_common.py`: config access, `make_flag` (builds ids like `R1-L2`), line pairing, number formatting, the mock-band note appended to reasons.
- `_geo.py`: country and city lookup for R4 and R5 from `data/reference/countries.csv` and `cities.csv`.

## Conventions

- **Skip, don't guess.** A rule that lacks what it needs (no band, no USD price) skips the line. R1 and R7 add a warning so the report says the check did not run.
- **Reasons are plain English** with figures formatted for the size of the number, and mention when a band is mock data.
- **Evidence** holds the raw numbers so the UI can chart them without parsing the text.
- R5 uses a short `parity_hs6` list (copper cathodes, green coffee) until real per-country medians exist; see `DECISIONS.md` D4.x.

To add a rule: create the file, add its code to `Rule` in `schemas.py` (a contract change: bump the version and log it) and to `RULE_CODES` in `_common.py`, register it in `RULES` in `__init__.py`, put its thresholds in `config.yaml`, and add a test in `tests/rules/`.
