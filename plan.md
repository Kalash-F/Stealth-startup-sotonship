# TBML Invoice Checker — Build Plan for AI Agents

> **Read this whole file before writing any code.** This is the single source of truth.
> Work top to bottom. Tick boxes as you go (`- [ ]` → `- [x]`). Never skip a checkpoint.

---

## 0. How to use this file (rules for every agent)

### 0.1 Working loop
For every task:
1. **Read** the task, its acceptance criteria, and the relevant contract in §4.
2. **Build** the smallest thing that meets the criteria.
3. **Verify** by running the commands listed — not by reading your own code and assuming it works.
4. **Tick** the box only after verification passes.
5. **Log** one line in `PROGRESS.md` (format in §0.4).

### 0.2 Checkpoint protocol (mandatory)
Each phase ends with a **🔒 CHECKPOINT**. At a checkpoint you must:
- [ ] Run every command listed under "Verify" and paste the real output summary into `PROGRESS.md`.
- [ ] Confirm every acceptance criterion is met, one by one, in writing.
- [ ] Run the full test suite (`make test`), not just the new tests. Earlier phases must still pass.
- [ ] Re-read §4 (contracts) and confirm nothing you built drifts from it.
- [ ] Commit with message `checkpoint: phase N complete`.

**You may not start phase N+1 until checkpoint N passes.**

### 0.3 When something fails
- Fix the cause. Do not delete, skip, or weaken a test to make it pass.
- Do not lower a numeric threshold in this file without writing the reason in `DECISIONS.md`.
- After **3 failed attempts** at the same problem: stop, write a `BLOCKED:` entry in `PROGRESS.md` explaining what you tried and what you think is wrong, and ask the human.
- If you find this plan is wrong or ambiguous, write the issue to `DECISIONS.md`, choose the most conservative reading, and continue. Flag it at the next checkpoint.

### 0.4 Logging format
`PROGRESS.md` — append only:
```
[YYYY-MM-DD HH:MM] [phase.task] [owner P1–P4] DONE|FAIL|BLOCKED — one-line summary — evidence (test count, metric, file path)
```
`DECISIONS.md` — any deviation from this plan, any contract change, any assumption made.

### 0.5 Hard rules
- **Contracts are frozen.** Changing a schema in §4 requires: bump `SCHEMA_VERSION`, update every producer and consumer, update fixtures, log it in `DECISIONS.md`.
- **No live API calls at demo time.** All benchmark data is fetched by a script, cached to disk, and read from cache at runtime.
- **No fabricated data presented as real.** Mocked or synthetic data must be labelled `synthetic` or `mock` in the data itself and in the UI.
- **No secrets in git.** Keys live in `.env`; `.env.example` lists the variable names only.
- **No real client or personal data.** Synthetic invoices use invented companies and addresses only.
- **Reproducible.** Every random process takes a seed. Same seed → same output.
- **Explainable.** Every flag must carry a human-readable reason and the evidence behind it. No unexplained scores.

---

## 1. What we are building

**One line:** A tool that helps trade finance compliance officers catch trade-based money laundering (TBML) by checking invoice line items against global trade price benchmarks and a set of document red-flag rules, then producing a prioritised, explained review report.

**User:** a compliance officer reviewing an invoice before a bank issues a letter of credit.

**Flow:** upload invoice PDF → extract line items → classify each item to an HS6 commodity code → compare stated unit price to a benchmark price band → run red-flag rules → output a report with expected vs stated price, variance %, reasons, and an overall review priority.

**Baseline we must beat:** random spot-checks by human staff. At a fixed review budget (e.g. reviewing 20% of invoices), random selection catches ~20% of bad invoices. Our headline metric is how many we catch at the same budget.

**Positioning:** the output is a *review priority with reasons*, never a fraud verdict. The officer decides.

**Red-flag source:** HMRC TBML handbook, Evidence section — https://www.gov.uk/guidance/trade-based-money-laundering-tbml-handbook/evidence. Its case study describes placeholder product names on invoices, routes with no economic logic, quantity/value mismatches, delivery to residential addresses, and geographic errors in country-of-origin fields. Our rules are modelled on these.

---

## 2. Scope

### In scope (MVP)
- PDF invoices (text-based; scanned is a stretch goal).
- 7 commodities (§5.1) and 4 trade routes (§5.2).
- Price benchmarking from cached UN Comtrade + HMRC UK Trade Info data.
- 8 rule types (§7.2).
- REST API, officer-facing web app, evaluation report.
- A public-facing project website explaining the product (§10).

### Out of scope (MVP) — do not build
- Bills of lading, packing lists, certificates of origin.
- Vessel tracking, sanctions screening, Companies House lookups (listed in §12 backlog).
- User accounts, auth, multi-tenancy.
- Model training / fine-tuning.

---

## 3. Tech stack and repo layout

### 3.1 Stack (use these unless a checkpoint proves one unworkable — log it in `DECISIONS.md`)
| Layer | Choice |
|---|---|
| Backend language | Python 3.11+ |
| API | FastAPI + Uvicorn |
| Schemas | Pydantic v2 |
| PDF text | pdfplumber |
| PDF generation (synthetic data) | Jinja2 HTML templates → WeasyPrint (fallback: ReportLab) |
| LLM | Anthropic API via `anthropic` SDK; model name in `.env` as `LLM_MODEL`; key as `ANTHROPIC_API_KEY` |
| Data / cache | Parquet or CSV under `data/benchmarks/`, plus SQLite for lookups if needed |
| Tests | pytest, pytest-cov |
| Lint/format | ruff |
| Frontend (app + website) | Vite + React + TypeScript + Tailwind CSS |
| Frontend tests | Vitest + Playwright (smoke) |

### 3.2 Repo layout
```
tbml-checker/
├── plan.md                 # this file
├── PROGRESS.md             # append-only log
├── DECISIONS.md            # deviations, assumptions, contract changes
├── README.md
├── Makefile                # make setup | test | lint | api | web | eval | data
├── .env.example
├── backend/
│   ├── tbml/
│   │   ├── schemas.py      # §4 contracts — single source of truth
│   │   ├── extract/        # P1: PDF → Invoice
│   │   ├── classify/       # P2: line item → HS6 + normalised quantity
│   │   ├── benchmark/      # P2: price bands from cache
│   │   ├── rules/          # P3: one file per rule
│   │   ├── score/          # P3: combine flags → priority
│   │   ├── pipeline.py     # chains all stages
│   │   └── api.py          # FastAPI app
│   ├── scripts/
│   │   ├── fetch_benchmarks.py
│   │   ├── generate_invoices.py
│   │   └── evaluate.py
│   └── tests/
│       ├── fixtures/       # golden JSON for every contract
│       └── ...
├── data/
│   ├── benchmarks/         # cached trade data + computed bands
│   ├── synthetic/
│   │   ├── pdfs/
│   │   ├── truth/          # ground-truth JSON per invoice
│   │   └── labels.csv
│   └── reference/          # HS code list, country list, etc.
├── web/
│   ├── src/
│   │   ├── site/           # public project website (§10)
│   │   └── app/            # officer checker app (§9)
│   └── ...
└── reports/
    └── eval/               # evaluation outputs (§8)
```

---

## 4. Data contracts (frozen — see §0.5)

Define all of these in `backend/tbml/schemas.py` with `SCHEMA_VERSION = "1.0"`. Every contract gets a golden fixture in `backend/tests/fixtures/` and a test that the fixture validates.

### 4.1 `Party`
| Field | Type | Notes |
|---|---|---|
| name | str | |
| address | str | full address as printed |
| country | str | ISO-3166 alpha-2 |
| address_type | enum `commercial \| residential \| unknown` | |

### 4.2 `LineItem`
| Field | Type | Notes |
|---|---|---|
| line_id | str | `L1`, `L2`, … |
| description | str | verbatim |
| quantity | float | |
| unit | str | as printed: `pcs`, `kg`, `cartons`, … |
| unit_price | float | in invoice currency |
| line_total | float | as printed |
| extraction_confidence | float 0–1 | |

### 4.3 `Invoice`
| Field | Type | Notes |
|---|---|---|
| invoice_id | str | |
| invoice_date | date | |
| seller | Party | |
| buyer | Party | |
| consignee | Party \| null | delivery party if different |
| country_of_origin | str \| null | as printed (keep raw text) |
| port_of_loading | str \| null | |
| port_of_discharge | str \| null | |
| incoterm | str \| null | e.g. FOB, CIF |
| currency | str | ISO-4217 |
| line_items | list[LineItem] | |
| stated_total | float | |
| source_file | str | |
| is_synthetic | bool | |

### 4.4 `EnrichedLine` (P2 output)
| Field | Type | Notes |
|---|---|---|
| line_id | str | |
| hs6 | str \| null | 6 digits, null if unclassifiable |
| hs6_description | str \| null | official description |
| hs6_candidates | list[{hs6, score}] | top 3 |
| classification_confidence | float 0–1 | |
| normalised_quantity | float \| null | in benchmark unit |
| benchmark_unit | str \| null | e.g. `kg`, `u` (units) |
| unit_price_usd | float \| null | stated price converted to USD per benchmark unit |
| normalisation_note | str | how the conversion was done, or why it failed |

### 4.5 `Benchmark`
| Field | Type | Notes |
|---|---|---|
| hs6 | str | |
| route | str \| null | `CN-GB` etc., null = global |
| unit | str | |
| p10 / p25 / median / p75 / p90 | float | USD per unit |
| n_observations | int | |
| years | list[int] | |
| sources | list[str] | `UN Comtrade`, `HMRC OTS` |
| is_mock | bool | |

### 4.6 `Flag`
| Field | Type | Notes |
|---|---|---|
| flag_id | str | |
| rule | enum | see §7.2 |
| line_id | str \| null | null = invoice-level flag |
| severity | enum `low \| medium \| high` | |
| expected | str \| null | e.g. `$0.02–$0.09 per unit` |
| stated | str \| null | e.g. `$50.00 per unit` |
| variance_pct | float \| null | |
| reason | str | plain English, one or two sentences |
| evidence | dict | raw numbers and source references |

### 4.7 `Report`
| Field | Type | Notes |
|---|---|---|
| invoice_id | str | |
| schema_version | str | |
| priority_score | float 0–100 | |
| priority_band | enum `review_now \| review \| low` | |
| summary | str \| null | one or two sentences; null when the LLM call failed (schema 1.1) |
| invoice | Invoice | the invoice as extracted, header and parties included (schema 1.2) |
| flags | list[Flag] | |
| lines | list[{LineItem + EnrichedLine + Benchmark \| null}] | |
| processing_ms | int | |
| warnings | list[str] | e.g. "line L3 could not be classified" |

---

## 5. Reference choices

### 5.1 Commodities (HS6)
Agents must **verify each code and description against the HMRC commodity API** in Phase 3 and record the official description. If a code is wrong, fix it here and log in `DECISIONS.md`.

| HS6 | Expected description (verify) | Why chosen |
|---|---|---|
| 731815 | Other screws and bolts, iron or steel | The pitch example; wide legit price spread |
| 220210 | Waters with added sugar / flavoured (soft & energy drinks) | Mirrors HMRC case study |
| 852351 | Solid-state non-volatile storage (USB drives) | Mirrors HMRC case study |
| 610910 | T-shirts, cotton, knitted | High volume, common TBML good |
| 090111 | Coffee, not roasted, not decaffeinated | Commodity with public prices |
| 740311 | Refined copper cathodes | High value per kg |
| 847130 | Portable computers (laptops) | High value per unit |

### 5.2 Routes
`CN-GB`, `AE-GB`, `GB-AE`, `AE-CZ`

### 5.3 Data sources
- **UN Comtrade** — free key from comtradedeveloper.un.org; keyless preview is capped. Python package `comtradeapicall`.
- **HMRC UK Trade Info API** — `https://api.uktradeinfo.com` — no key; OTS endpoint gives value (GBP), net mass (kg), supplementary units by commodity code and partner country.
- **FX** — use a fixed annual average rate table committed to `data/reference/fx.csv` for the MVP. Record the source and year.

---

## PHASE 0 — Setup and contracts
**Goal:** a repo where every stage exists as a stub that passes mock data through end to end.

- [x] 0.1 Create repo layout from §3.2. Add `Makefile` targets: `setup`, `test`, `lint`, `api`, `web`, `data`, `eval`.
- [x] 0.2 Create `.env.example` with `ANTHROPIC_API_KEY`, `LLM_MODEL`, `COMTRADE_API_KEY`.
- [x] 0.3 Implement all §4 schemas in `schemas.py`.
- [x] 0.4 Write one golden fixture per schema in `tests/fixtures/` (realistic values, `is_synthetic: true`).
- [x] 0.5 Write `tests/test_schemas.py`: every fixture validates; invalid examples (missing field, wrong type, bad enum) are rejected.
- [x] 0.6 Create stub functions for each stage that return fixture data:
  - `extract(pdf_path) -> Invoice`
  - `enrich(invoice) -> list[EnrichedLine]`
  - `benchmark(enriched_line) -> Benchmark | None`
  - `run_rules(invoice, enriched, benchmarks) -> list[Flag]`
  - `score(flags) -> (priority_score, priority_band)`
  - `pipeline.check(pdf_path) -> Report`
- [x] 0.7 Create `PROGRESS.md` and `DECISIONS.md`.

### 🔒 CHECKPOINT 0
**Verify:**
```
make setup
make lint
make test
python -c "from tbml.pipeline import check; r = check('any.pdf'); print(r.model_dump_json(indent=2)[:500])"
```
**Acceptance criteria:**
- [x] Lint clean, all tests pass.
- [x] `check()` returns a valid `Report` built entirely from stubs.
- [x] Every schema in §4 exists with a fixture and a validation test.
- [x] Field names in code match §4 exactly (diff them by eye, field by field).

---

## PHASE 1 — Synthetic invoice dataset (P4)
**Goal:** a labelled, reproducible dataset that every other phase tests against. **This unblocks P1 and P3 — build it first.**

### Tasks
- [x] 1.1 Build 2–3 HTML invoice templates (Jinja2) that look different from each other: different layouts, table styles, field labels (e.g. "Qty" vs "Quantity", "Unit Price" vs "Rate"). Real invoices are inconsistent; ours should be too.
- [x] 1.2 Build a generator `scripts/generate_invoices.py --seed 42 --n 60` that:
  - Invents seller/buyer/consignee companies and addresses (clearly fictional).
  - Picks a route from §5.2 and 1–5 line items from §5.1 commodities.
  - Sets *clean* prices by sampling inside the benchmark p25–p75 band (use placeholder bands until Phase 3 lands, then regenerate).
  - Renders to PDF in `data/synthetic/pdfs/`.
  - Writes ground truth in `data/synthetic/truth/{invoice_id}.json` (the full `Invoice` object) and one row per planted anomaly in `labels.csv`.
- [x] 1.3 Plant anomalies. ~30% of invoices carry at least one. Each anomaly type must appear at least 4 times:

| Label | How to plant |
|---|---|
| `OVER_PRICE` | unit price ×3 to ×1000 above median |
| `UNDER_PRICE` | unit price ÷3 to ÷100 below median |
| `QTY_VALUE_IMPLAUSIBLE` | small quantity, huge total (e.g. 7,000 USB drives at £300 each) |
| `PLACEHOLDER_DESC` | descriptions like "Product ABC", "Goods as per contract", "Item 1" |
| `GEO_INCONSISTENT` | country of origin text contradicts itself (city in wrong country), or origin ≠ port of loading country with no explanation |
| `ROUTE_NO_ECONOMIC_SENSE` | goods shipped between two countries where benchmark prices are near identical, at a high stated price |
| `ARITHMETIC_ERROR` | line totals ≠ qty × price, or sum ≠ stated total |
| `RESIDENTIAL_CONSIGNEE` | consignee address is a flat/house for commercial-volume goods |

- [x] 1.4 Plant **hard negatives** (clean invoices that look suspicious): premium goods priced near p90, bulk discounts near p10, legitimate unusual routes. ~10% of the set. Label them `CLEAN_HARD` in a separate column so evaluation can report false positives on them.
- [x] 1.5 Write `tests/test_synthetic.py`:
  - Same seed → byte-identical `labels.csv` and truth JSON.
  - Every truth JSON validates as `Invoice`.
  - Every anomaly type count ≥ 4.
  - Every planted arithmetic error actually fails the arithmetic (recompute it).
  - Clean invoices actually pass arithmetic.
- [x] 1.6 Open 5 random PDFs (render page 1 to PNG) and visually confirm they look like real invoices and that text is selectable.

### 🔒 CHECKPOINT 1
**Verify:**
```
python backend/scripts/generate_invoices.py --seed 42 --n 60
python backend/scripts/generate_invoices.py --seed 42 --n 60 --out /tmp/rerun && diff -r data/synthetic/truth /tmp/rerun/truth
make test
```
**Acceptance criteria:**
- [x] 60 PDFs, 60 truth files, `labels.csv` present.
- [x] Rerun with same seed produces no diff.
- [x] Anomaly distribution table printed and pasted into `PROGRESS.md`.
- [x] 5 PDFs inspected visually; notes logged.

---

## PHASE 2 — Extraction (P1)
**Goal:** PDF → valid `Invoice` with high field accuracy.

### Tasks
- [x] 2.1 Text extraction with pdfplumber (text + tables). Store raw text for debugging.
- [x] 2.2 LLM structuring: send raw text + the `Invoice` JSON schema; require JSON output; validate with Pydantic; on validation failure, retry once with the error message included; on second failure, return partial result with warnings.
- [x] 2.3 Address type: classify `address_type` (commercial / residential / unknown) with simple heuristics first (keywords: "Flat", "Apt", "House", "Unit", "Industrial Estate", "Warehouse", "Ltd"), LLM fallback.
- [x] 2.4 Set `extraction_confidence` per line (e.g. lower when numbers needed repair or fields were missing).
- [x] 2.5 Cache LLM responses keyed by file hash so reruns are free and deterministic.
- [x] 2.6 Write `tests/test_extract.py` comparing extraction against truth JSON for all 60 synthetic invoices. Field-level accuracy report: numeric fields must match within 0.01; strings by normalised equality.
- [ ] 2.7 (Stretch) vision fallback for scanned PDFs.

### 🔒 CHECKPOINT 2
**Verify:**
```
pytest backend/tests/test_extract.py -v
python -m tbml.extract data/synthetic/pdfs/<any>.pdf
```
**Acceptance criteria:**
- [ ] ≥ 98% accuracy on `quantity`, `unit_price`, `line_total`, `stated_total`.
- [ ] ≥ 95% accuracy on all other fields.
- [ ] 100% of outputs validate as `Invoice` (partial results allowed but must validate).
- [ ] Every miss is listed in `PROGRESS.md` with the cause. Do not move on if misses cluster in one template — fix it.
- [ ] Second run of the test makes zero LLM calls (cache works).

---

## PHASE 3 — Classification and benchmarks (P2)
**Goal:** every line item mapped to HS6 with a normalised price in USD per benchmark unit, and a cached price band for each commodity.

### 3A. Benchmark data
- [ ] 3.1 `scripts/fetch_benchmarks.py`: for each HS6 in §5.1, pull the latest 3 available years from UN Comtrade (all reporters, plus the §5.2 routes) and HMRC OTS. Save raw responses to `data/benchmarks/raw/` with fetch date.
- [ ] 3.2 Compute unit values (trade value ÷ quantity) per record. Drop records with zero/missing quantity. Record the quantity unit per HS6 (`kg`, `u`, etc.).
- [ ] 3.3 Remove outliers before computing bands (drop the top and bottom 1% of unit values per HS6), then compute p10/p25/median/p75/p90 globally and per route (per-route only if `n_observations ≥ 10`, otherwise fall back to global and say so).
- [ ] 3.4 Write bands to `data/benchmarks/bands.parquet` matching the `Benchmark` schema.
- [ ] 3.5 If APIs are unreachable, create `bands_mock.parquet` with `is_mock: true` from documented approximate values, and log it in `DECISIONS.md`. The UI must show a "mock benchmark" badge when these are used.

### 3B. Classification
- [ ] 3.6 Load the official HS6 list (HMRC commodity endpoint or WCO list) into `data/reference/hs6.csv`.
- [ ] 3.7 Classifier: LLM proposes top 3 HS6 candidates with scores for each description → keep only candidates that exist in `hs6.csv` → pick the top one. If the top score < 0.5 or nothing valid remains, `hs6 = null` with a reason.
- [ ] 3.8 Placeholder descriptions ("Product ABC") must come back `hs6 = null` with a low confidence. Do not let the LLM guess a code for them.

### 3C. Normalisation
- [ ] 3.9 Unit conversion table `data/reference/unit_weights.csv`: typical kg per piece for count-based items (e.g. one M6 screw, one USB drive, one T-shirt, one laptop). Document the source or reasoning for each value.
- [ ] 3.10 Convert stated price to USD (fx table) per benchmark unit. If conversion is impossible, set `unit_price_usd = null` and explain in `normalisation_note`. Never guess silently.

### 3D. Tests
- [ ] 3.11 `test_classify.py`: against synthetic truth (generator knows the true HS6). Placeholder descriptions must be null.
- [ ] 3.12 `test_benchmark.py`: bands monotonic (p10 ≤ p25 ≤ median ≤ p75 ≤ p90); n_observations > 0; every §5.1 code has a band.
- [ ] 3.13 `test_normalise.py`: hand-worked examples for each commodity (write the expected number in the test with the arithmetic in a comment).

### 🔒 CHECKPOINT 3
**Verify:**
```
python backend/scripts/fetch_benchmarks.py
python -c "import pandas as pd; print(pd.read_parquet('data/benchmarks/bands.parquet'))"
pytest backend/tests/test_classify.py backend/tests/test_benchmark.py backend/tests/test_normalise.py -v
```
**Acceptance criteria:**
- [ ] All 7 HS6 codes verified against an official source; descriptions recorded.
- [ ] Band table printed and pasted into `PROGRESS.md`. Sanity check each band by eye: does a laptop cost hundreds of dollars per unit? Does copper cathode cost single-digit dollars per kg? If anything is off by 10×, find out why before moving on (usually a unit mismatch).
- [ ] Classification accuracy ≥ 90% on non-placeholder lines; 100% of placeholder lines → null.
- [ ] Regenerate the synthetic set (Phase 1) using real bands, rerun Phase 1 and 2 tests — still passing.

---

## PHASE 4 — Rules and scoring (P3)
**Goal:** each rule produces explained `Flag`s; scoring turns flags into a priority.

### 4.1 Rule design rules
- One file per rule in `backend/tbml/rules/`. Each exposes `check(invoice, enriched, benchmarks) -> list[Flag]`.
- Every flag must fill `reason` in plain English and `evidence` with the numbers used.
- Thresholds live in `backend/tbml/rules/config.yaml`, not in code.

### 4.2 Rules
- [x] R1 `PRICE_OUTLIER` — compare `unit_price_usd` to the band on a log scale.
  - `log_dev = ln(stated / median)`; `spread = ln(p90 / p10)`.
  - medium if outside p10–p90; high if `|log_dev| > spread` (more than one full band-width away).
  - Fires both directions; reason says "over-invoiced" or "under-invoiced".
  - Skips (no flag) if no benchmark or null price — add a warning instead.
- [x] R2 `QTY_VALUE_IMPLAUSIBLE` — line value very high relative to quantity for the commodity (uses the band's p90 × quantity × 10 as the ceiling), or invoice total disproportionate to item count.
- [x] R3 `PLACEHOLDER_DESC` — regex list (`product [A-Z]{2,3}`, `item \d+`, `goods as per`, `various`, `misc`) + description shorter than 3 words + classifier returned null.
- [x] R4 `GEO_INCONSISTENT` — country of origin text checked against a city→country gazetteer (`data/reference/cities.csv`, top ~500 trade cities); origin vs port of loading country mismatch.
- [x] R5 `ROUTE_NO_ECONOMIC_SENSE` — if origin and destination medians for the HS6 are within ±15% of each other AND stated price is above p75, flag: shipping makes little economic sense at this price.
- [x] R6 `ARITHMETIC_ERROR` — qty × price vs line total (tolerance 0.5% or 1 currency unit); sum of lines vs stated total.
- [x] R7 `RESIDENTIAL_CONSIGNEE` — consignee or buyer `address_type == residential` and invoice total above a threshold in config.
- [x] R8 `LOW_CONFIDENCE` — any line with extraction or classification confidence < 0.5 → low-severity flag telling the officer to check that line manually.

### 4.3 Scoring
- [x] 4.4 Weighted sum: high = 40, medium = 15, low = 5 points per flag, capped at 100. Bands: ≥ 60 `review_now`, 25–59 `review`, < 25 `low`. Weights in config.
- [x] 4.5 Report sorted: highest severity flags first.

### 4.4 Tests
- [x] 4.6 One unit test file per rule with at least: one true positive, one true negative, one edge case (exactly on threshold), one missing-data case.
- [x] 4.7 `test_rules_on_synthetic.py`: run every rule on truth invoices (bypassing extraction) and report per-rule precision and recall against `labels.csv`.

### 🔒 CHECKPOINT 4
**Verify:**
```
pytest backend/tests/rules -v
pytest backend/tests/test_rules_on_synthetic.py -v -s
```
**Acceptance criteria:**
- [ ] Every rule recall ≥ 0.9 on its own planted anomaly type (on truth data).
- [ ] False positive rate on `CLEAN_HARD` invoices ≤ 20%; list every false positive and its reason in `PROGRESS.md`.
- [ ] Read 10 random flag `reason` strings aloud: each must make sense to a compliance officer with no technical background. Rewrite any that don't.
- [ ] No threshold hardcoded outside `config.yaml` (grep for numbers in `rules/`).

---

## PHASE 5 — Pipeline + API integration (P1 lead)
**Goal:** real end-to-end: PDF in, `Report` out, over HTTP.

- [ ] 5.1 Replace every stub in `pipeline.py` with the real stage. Keep stubs available behind `USE_MOCKS=1` for frontend development.
- [ ] 5.2 FastAPI endpoints:
  - `POST /check` — multipart PDF → `Report`
  - `GET /reports/{invoice_id}` — cached report
  - `GET /samples` — list of bundled synthetic invoices for the demo
  - `GET /health` — status + whether benchmark data is real or mock
- [ ] 5.3 Store reports as JSON in `data/reports/`.
- [ ] 5.4 Timing: record `processing_ms`; log stage timings.
- [ ] 5.5 Errors: non-PDF upload → 400 with message; extraction failure → 200 with warnings and whatever was extracted; never 500 on bad input.
- [ ] 5.6 CORS for the frontend dev server.
- [ ] 5.7 `tests/test_api.py` using FastAPI TestClient: happy path, bad file, empty PDF, oversized PDF (> 10 MB → 413).

### 🔒 CHECKPOINT 5
**Verify:**
```
make api   # in one terminal
curl -s localhost:8000/health
curl -s -F "file=@data/synthetic/pdfs/<an anomalous one>.pdf" localhost:8000/check | python -m json.tool | head -80
pytest backend/tests/test_api.py -v
make test
```
**Acceptance criteria:**
- [ ] A planted `OVER_PRICE` invoice returns a high-severity `PRICE_OUTLIER` flag on the right line through the real API.
- [ ] A clean invoice returns `priority_band: low`.
- [ ] Median processing time per invoice < 15 s with warm cache (log the number).
- [ ] Full test suite green.

---

## PHASE 6 — Evaluation (P4)
**Goal:** the headline number, generated by a script, reproducible.

- [ ] 6.1 `scripts/evaluate.py`: run the full pipeline (from PDF, not truth) on every synthetic invoice.
- [ ] 6.2 Metrics:
  - Invoice-level: precision, recall, F1 for "has any anomaly".
  - Per anomaly type: recall.
  - **Review-budget comparison:** sort invoices by `priority_score`; at budgets of 10%, 20%, 30%, report % of anomalous invoices caught. Random baseline: simulate 10,000 random selections at the same budget and report mean and 95% interval.
  - False positives on `CLEAN_HARD`.
- [ ] 6.3 Output `reports/eval/summary.json` and `reports/eval/summary.md` (a table + one chart as PNG: % caught vs review budget, ours vs random).
- [ ] 6.4 Split the dataset: tune thresholds on seeds 1–3, report final numbers on a held-out seed (e.g. 99) the rules were never tuned on. State this clearly in the summary.

### 🔒 CHECKPOINT 6
**Verify:**
```
python backend/scripts/generate_invoices.py --seed 99 --n 60 --out data/synthetic_holdout
python backend/scripts/evaluate.py --data data/synthetic_holdout
cat reports/eval/summary.md
```
**Acceptance criteria:**
- [ ] At a 20% review budget, catch rate on the held-out set is reported alongside the random baseline interval. Target: ≥ 2.5× random. If below target, log why in `DECISIONS.md` — do not tune on the held-out set.
- [ ] Every number in `summary.md` traces to `summary.json`.
- [ ] Re-running produces identical numbers.

---

## PHASE 7 — Officer app UI (P3 lead, frontend)
**Goal:** the screen a compliance officer would actually use. Lives at `/app`.

### Screens
- [ ] 7.1 **Upload** — drag-and-drop PDF, or pick from bundled samples (`GET /samples`). Progress state while processing.
- [ ] 7.2 **Report** —
  - Header: invoice id, seller → buyer, route, priority badge (`review_now` red, `review` amber, `low` green), priority score.
  - Flag list sorted by severity; each flag shows rule name, reason, expected vs stated, variance %.
  - Line-item table: description, HS6 + description, qty, stated unit price, benchmark band (mini range bar showing p10–p90 with the stated price as a marker), variance %, flags on that line.
  - Evidence drawer: raw numbers, benchmark source, years, n observations.
  - Badges for `synthetic` and `mock benchmark` data where applicable.
  - Warnings section.
- [ ] 7.3 **Queue** (stretch) — list of all checked invoices sorted by priority.
- [ ] 7.4 Typed API client generated from or checked against §4 schemas.
- [ ] 7.5 Works against `USE_MOCKS=1` backend so UI can be built before Phase 5 finishes.

### 🔒 CHECKPOINT 7
**Verify:**
```
make web
npx playwright test   # smoke: upload sample → report renders → at least one flag visible
```
**Acceptance criteria:**
- [ ] Upload a planted anomaly invoice in the browser: correct line highlighted, range bar shows stated price outside the band.
- [ ] Usable at 375 px wide (phone) and 1440 px wide. Screenshot both and save to `reports/screenshots/`.
- [ ] No console errors.
- [ ] A non-technical person can explain why the invoice was flagged from the screen alone (ask a teammate; log their answer).

---

## PHASE 8 — Project website (public site describing the product)
**Goal:** a polished marketing / explainer website for the project, built from the brief the human provides. Lives at `/` in the same Vite app (officer app stays at `/app`).

### ⛔ INPUT REQUIRED — do not build final visuals until this is filled in
The human will supply the reference to base the site on. **If any field below is still `TODO`, stop at task 8.2 and ask for it.** You may do 8.1 and 8.2 before it arrives.

```
WEBSITE BRIEF
Reference site(s) / design to base it on:  TODO
What to take from the reference (layout, colours, typography, tone, sections):  TODO
Product name:  TODO  (placeholder: "TBML Checker")
Tagline:  TODO
Brand colours (hex):  TODO
Fonts:  TODO
Logo / assets provided:  TODO  (path in web/src/site/assets/)
Team members to show (name, role, link):  TODO
Hackathon / event context to mention:  TODO
Contact or call-to-action (email, form, "try the demo"):  TODO
Anything to avoid:  TODO
```

**Copying rule:** use the reference for *layout, structure, spacing, and feel*. Do not copy its text, logo, images, or brand. All copy and assets on our site must be our own.

### Tasks
- [ ] 8.1 Draft site copy in `web/src/site/content.md` from §1 and the Phase 6 results (no lorem ipsum anywhere). Sections:
  1. **Hero** — product name, one-line value proposition, primary CTA ("Try the demo" → `/app`), secondary CTA ("How it works").
  2. **The problem** — what TBML is in two sentences; why manual spot-checks miss it; the cost of AML control failures (only claims we can source — add the source link next to each claim in `content.md`).
  3. **How it works** — 4-step visual: Upload → Extract → Benchmark → Flag & explain.
  4. **What it catches** — cards for each rule (§4.2), each with a one-line plain-English example, e.g. "100,000 screws billed at $50 each".
  5. **Live example** — static screenshot or embedded mini-version of a real report from Phase 7.
  6. **Results** — headline metric from `reports/eval/summary.json` (catch rate vs random at 20% budget) with the chart. Must say clearly it's measured on synthetic data.
  7. **Built for compliance teams** — explainability, audit trail, officer stays in control, API-first.
  8. **Roadmap** — short version of §12.
  9. **Team** — from the brief.
  10. **Footer** — data sources (UN Comtrade, HMRC UK Trade Info, HMRC TBML handbook), disclaimer ("prototype; not a compliance determination"), repo link.
- [ ] 8.2 Wireframe: build the section skeleton with real copy and neutral styling. Get human sign-off on structure if they are available; otherwise proceed and note it.
- [ ] 8.3 Apply the brief: design tokens (colours, fonts, spacing, radius) defined once in Tailwind config / CSS variables, not scattered.
- [ ] 8.4 Build components: `Nav`, `Hero`, `Problem`, `HowItWorks`, `RuleCards`, `ExampleReport`, `Results`, `Features`, `Roadmap`, `Team`, `Footer`.
- [ ] 8.5 Results section reads numbers from `summary.json` at build time — never hardcoded.
- [ ] 8.6 Responsive at 375 / 768 / 1440 px. Dark mode if the reference has one.
- [ ] 8.7 Accessibility: semantic headings in order, alt text on every image, colour contrast AA, keyboard navigable, visible focus states.
- [ ] 8.8 Meta: page title, description, Open Graph image, favicon.
- [ ] 8.9 Performance: images compressed, no layout shift on load.

### 🔒 CHECKPOINT 8
**Verify:**
```
npm run build && npm run preview
npx playwright test site   # every nav link resolves; CTA reaches /app; no 404s
npx lighthouse http://localhost:4173 --only-categories=performance,accessibility,best-practices,seo --quiet
grep -ri "lorem\|TODO\|placeholder" web/src/site
```
**Acceptance criteria:**
- [ ] Lighthouse ≥ 90 on accessibility, best practices, SEO; ≥ 80 performance. Paste scores into `PROGRESS.md`.
- [ ] Grep above returns nothing.
- [ ] Every factual claim on the site has a source in `content.md`; every number matches `summary.json`.
- [ ] Screenshots at 375 / 768 / 1440 saved to `reports/screenshots/site/` and compared side by side with the reference. List 3 ways ours matches the brief and anything that doesn't.
- [ ] No copied text, logos, or images from the reference.

---

## PHASE 9 — Demo hardening
**Goal:** nothing can go wrong on stage.

- [ ] 9.1 Pick 3 demo invoices: one obvious (screws at $50), one subtle (15× over-priced coffee plus a placeholder line), one clean hard negative (premium laptops — should come back low). Pre-run them; cache reports.
- [ ] 9.2 Offline mode: with network disabled, the whole demo still works (cached LLM responses, cached bands, local assets, no CDN fonts).
- [ ] 9.3 `make demo` starts backend + frontend with one command.
- [ ] 9.4 Write `DEMO.md`: click-by-click script, timings, what to say at each screen, fallback if the live upload fails (open pre-cached report).
- [ ] 9.5 README: what it is, how to run, architecture diagram, data sources, limitations, results.
- [ ] 9.6 Fresh-clone test: clone into a new folder, follow README only, reach a working demo.

### 🔒 CHECKPOINT 9 (final)
**Verify:**
```
# with Wi-Fi off
make demo
# run DEMO.md end to end, timed
make test && make lint
```
**Acceptance criteria:**
- [ ] Demo runs fully offline, under the time limit, three times in a row.
- [ ] Fresh-clone test passes.
- [ ] All boxes in Phases 0–9 ticked, `PROGRESS.md` has a checkpoint entry for each phase.
- [ ] `DECISIONS.md` reviewed; every deviation is defensible.

---

## 10. Team ownership map
| Owner | Phases | Hands off to |
|---|---|---|
| P1 — Extraction + backend | 2, 5 | P2 (Invoice), P3 (API for UI) |
| P2 — Classification + benchmarks | 3 | P3 (EnrichedLine, Benchmark) |
| P3 — Rules, scoring, officer app | 4, 7 | P4 (Reports for eval) |
| P4 — Data, evaluation, website, pitch | 1, 6, 8, 9 | Everyone (dataset first) |
| All | 0 | — |

Parallel work is possible because of the stubs in Phase 0 and `USE_MOCKS=1`. Phases 2, 3, 4, 7 and 8.1–8.2 can run in parallel once Checkpoints 0 and 1 pass.

---

## 11. Known risks (check at every checkpoint)
| Risk | Mitigation |
|---|---|
| Unit mismatch (pieces vs kg) makes price checks meaningless | Phase 3 sanity check by eye; `normalisation_note` mandatory; null rather than guess |
| Comtrade/HMRC unreachable or rate-limited | Fetch early, cache, mock fallback with visible badge |
| LLM non-determinism breaks tests | Cache by file hash; temperature 0; schema validation + retry |
| Overfitting rules to our own synthetic data | Held-out seed; hard negatives; honest labelling of results as synthetic |
| Scope creep | Anything not in §2 goes to §12, not into the build |
| Website claims we can't back up | Every claim sourced in `content.md`; numbers from `summary.json` |

---

## 12. Post-MVP backlog (do not build during the MVP)
- [ ] Multi-document checks: bill of lading, packing list, certificate of origin; cross-document mismatch rules.
- [ ] Route- and incoterm-adjusted benchmarks (FOB vs CIF), time and FX adjustment per invoice date.
- [ ] Commercial price feeds for exchange-traded goods (metals, coffee).
- [ ] Companies House lookups: company age, officer changes, filing history.
- [ ] Sanctions and dual-use goods screening.
- [ ] Vessel / container tracking to detect phantom shipments.
- [ ] Officer feedback loop: dispositions (cleared / escalated / reported) stored as labels; thresholds tuned per bank and per corridor.
- [ ] Classifier trained on officer HS-code corrections.
- [ ] Audit log for every flag and decision; model risk documentation.
- [ ] Deployment inside a bank's trade finance platform via API; data residency; no training on client documents.
- [ ] Per-invoice API pricing and usage metering.
