# Data

| Folder | Content | Produced by |
|---|---|---|
| `reference/` | Small hand-maintained lookup tables the code reads at runtime | by hand |
| `reference/hs/` | Every HS6 code the World Bank WITS API serves, as SQL: `hs2` → `hs4` → `hs6` | `backend/scripts/fetch_hs_codes.py` |
| `benchmarks/` | Price bands per HS6 (and route), plus cached raw API responses | `backend/scripts/fetch_benchmarks.py` |
| `synthetic/` | Fictional labelled invoices (PDF, truth JSON, label CSVs) | `backend/scripts/generate_invoices.py` |

Runtime-generated folders (`cache/`, and `reports/` once the API caches reports) are not source data.

## reference/

| File | Used by | Notes |
|---|---|---|
| `hs6.csv` | `classify` | Valid HS6 codes, descriptions, keywords and exclusions for the offline classifier. Partial and not yet verified against an official list. |
| `unit_weights.csv` | `classify.normalise` | kg per bag or per piece for converting counted goods to weight, with the basis for each figure. |
| `fx.csv` | `classify.normalise`, rules R7, synthetic | Approximate 2024 currency rates, units per USD. |
| `fx_annual.csv` | `fetch_benchmarks.py` | Approximate annual USD per unit, to convert HMRC values. |
| `countries.csv`, `cities.csv` | rules R4, R5 | ISO codes with aliases, and a gazetteer of trade cities and ports. |
| `placeholder_bands.json` | synthetic generator | Approximate bands used before real ones exist. |
| `hs/*.sql` | not yet read by code | `hs2` (chapter, `hs2_code`, `name`) → `hs4` (heading, `hs4_code`, `hs2_code`, `name`) → `hs6` (subheading, `hs6_code`, `hs4_code`, `name`): 96 / 1265 / 6882 rows, all HS revisions merged. `hs6` is the WITS API product list (`/API/V1/wits/datasource/trn/product/all`) verbatim, so names carry the code and the years the code was valid, e.g. `852351 -- (2007-) -- Solid-state non-volatile storage devices`. The API has no chapter or heading names; those come from the `HS Nomenclature` sheet of WITS's `HSProducts.xls`, whose HS6 rows the script checks are identical to the API's. WITS stores descriptions in a 255-character field, so some long names end mid-word in the source. `--nomenclature H6` builds HS 2022 alone instead (5612 codes, names without codes or years). `make hs-codes` regenerates the files and loads them into the SQLite database `hs.db` at the repo root; for PostgreSQL run each file in name order. |

Rates and bands marked approximate are not authoritative; verify before any production use.

## benchmarks/

`bands.parquet` (real, from UN Comtrade and HMRC) is used when present, else `bands_mock.parquet`. Mock rows are marked `is_mock=True` and every flag that relies on them says so. Fetching real bands needs a networked machine and a `COMTRADE_API_KEY`; see `NOTES-benchmarks.md`.

## synthetic/

All companies, people and addresses are fictional. See [backend/tbml/synthetic/README.md](../backend/tbml/synthetic/README.md) for the file formats.
