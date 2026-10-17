# DECISIONS

Deviations from `plan.md`, contract interpretations, and assumptions. Newest at the bottom.

## Phase 0

- **D0.1 Repo layout: no `tbml-checker/` wrapper.** plan §3.2 shows everything under `tbml-checker/`. The repo root *is* that folder, so `backend/`, `data/`, `web/`, `reports/` sit at the repo root.
- **D0.2 Backend is an installable package.** `backend/pyproject.toml` defines package `tbml`; `make setup` creates `.venv/` and runs `pip install -e "backend[dev]"`, so `from tbml.pipeline import check` works from anywhere with the venv active. `tbml/paths.py` assumes an editable install (it resolves `data/` relative to the source tree).
- **D0.3 Python version.** plan says 3.11+. Developed and tested on 3.13; `requires-python = ">=3.11"`.
- **D0.4 Rule enum source.** plan §4.6 says the `rule` enum is "see §7.2", but there is no §7.2; the rules are R1–R8 in Phase 4 §4.2. `Rule` enum = `PRICE_OUTLIER, QTY_VALUE_IMPLAUSIBLE, PLACEHOLDER_DESC, GEO_INCONSISTENT, ROUTE_NO_ECONOMIC_SENSE, ARITHMETIC_ERROR, RESIDENTIAL_CONSIGNEE, LOW_CONFIDENCE`.
- **D0.5 `Report.lines` shape.** plan §4.7 says `list[{LineItem + EnrichedLine + Benchmark | null}]`. Implemented as `ReportLine`: every `LineItem` field and every `EnrichedLine` field flattened into one object (they share `line_id`), plus `benchmark: Benchmark | null`. Frontend code should read e.g. `report.lines[0].unit_price`, `report.lines[0].hs6`, `report.lines[0].benchmark?.p90`.
- **D0.6 `hs6_candidates` item shape.** `{hs6: str, score: float 0–1}` as model `HS6Candidate`; at most 3 entries ("top 3").
- **D0.7 Nullable means required-but-nullable.** Every field typed `X | null` in §4 must be present in the JSON; its value may be `null`. No field has a default. This is the strictest reading and makes "missing field" tests meaningful.
- **D0.8 Validation added beyond §4 types** (all derived from the §4 notes column): unknown fields rejected (`extra="forbid"`); `country` = 2 upper-case letters; `currency` = 3 upper-case letters; `hs6` = 6 digits; `line_id` = `L<n>`; `Benchmark.route` = `XX-XX` or null; confidences 0–1; `priority_score` 0–100; `n_observations`, `processing_ms` ≥ 0; `Benchmark` bands must satisfy p10 ≤ p25 ≤ median ≤ p75 ≤ p90 (the Phase 3 monotonic requirement, enforced at the contract so a bad band can never be loaded).
- **D0.9 Fixtures are mock.** The benchmark fixture has `is_mock: true` and `sources: ["mock (test fixture)"]`; the invoice fixture has `is_synthetic: true` and company names suffixed "(synthetic)".
- **D0.10 Stub API.** `api.py` already serves `GET /health` and a stub `POST /check` (returns the fixture report) with CORS for the Vite dev server, so frontend work can start before Phase 5. Full Phase 5 endpoints/error handling are not built.
- **D0.11 Extra dependencies declared up front.** `pandas` and `pyarrow` (Phase 3 parquet bands) are in `backend/pyproject.toml` now, so parallel threads don't have to edit the same dependency list.
