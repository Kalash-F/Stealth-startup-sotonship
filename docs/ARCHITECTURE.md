# Architecture

How the TBML Invoice Checker works, stage by stage. `plan.md` is the build plan, `DECISIONS.md` records where the code deviates from it, and `PROGRESS.md` is the work log. This file explains the code as it stands.

The tool reads one invoice PDF and produces a **review priority with reasons**. It never says an invoice is fraudulent. Every flag carries a plain-English reason and the numbers behind it, so a compliance officer can check the call.

## The pipeline

```
PDF ──► extract ──► classify ──► benchmark ──► rules ──► score ──► Report
        Invoice     EnrichedLine  Benchmark     Flag[]    0-100     (API / UI)
```

`backend/tbml/pipeline.py` (`check(pdf_path)`) chains the stages. Each stage's input and output is a typed contract in `backend/tbml/schemas.py`, so stages can be built, tested and replaced independently.

| Stage | Package | In | Out | Detail |
|---|---|---|---|---|
| Extract | `tbml.extract` | PDF path | `Invoice` + warnings | [extract/README.md](../backend/tbml/extract/README.md) |
| Classify and normalise | `tbml.classify` | `Invoice` | one `EnrichedLine` per line | [classify/README.md](../backend/tbml/classify/README.md) |
| Benchmark | `tbml.benchmark` | `EnrichedLine` | `Benchmark` or `None` | below |
| Rules | `tbml.rules` | invoice, lines, bands | `Flag[]` (worst first) | [rules/README.md](../backend/tbml/rules/README.md) |
| Score | `tbml.score` | `Flag[]` | score 0-100 and `PriorityBand` | below |

`check` then merges each `LineItem`, its `EnrichedLine` and its `Benchmark` into a `ReportLine`, adds the extraction warnings and the rules' skip warnings (for example "no price benchmark, so the price check was skipped"), and returns a `Report`. Stage timings are logged at INFO under `tbml.pipeline`. With `USE_MOCKS=1`, extraction and benchmarking are swapped for the Phase 0 fixtures in `tbml/stubs.py`; classification, rules and scoring stay real.

### Data contracts

All of them live in `backend/tbml/schemas.py` (`SCHEMA_VERSION = "1.0"`). They are frozen: changing one means bumping the version, updating every producer, consumer and fixture, and logging it in `DECISIONS.md`. Unknown fields are rejected, so drift fails loudly. Golden examples are in `backend/tests/fixtures/`.

- `Invoice`: header fields, three `Party` objects (seller, buyer, optional consignee) and a list of `LineItem`, exactly as printed. Numbers are never corrected here, because a wrong total is itself a finding.
- `EnrichedLine`: HS6 code (or `None`), up to three candidates, confidence, and the quantity and USD price converted to the benchmark unit.
- `Benchmark`: a USD-per-unit price band (p10, p25, median, p75, p90) for an HS6, globally or for an `ORIGIN-DEST` route, with an `is_mock` marker.
- `Flag`: rule, line (or invoice level), severity, expected versus stated, a reason, and an `evidence` dict.
- `Report`: priority score and band, flags, enriched lines with their bands, timing and warnings.

### Benchmark

Prices are checked against bands of historical trade unit values (UN Comtrade and HMRC), cached in `data/benchmarks/` as parquet so the runtime never calls an API. `backend/scripts/fetch_benchmarks.py` builds the cache. Without network access it writes `bands_mock.parquet`, approximate stand-ins marked `is_mock=True`, and every reason that relies on them says so. Route-specific bands win over global ones when they have enough observations.

`tbml.benchmark.benchmark(line, route)` reads `bands.parquet` if it exists, else `bands_mock.parquet`, once per process. It returns the band for the line's HS6 on the invoice's route (`ORIGIN-DEST`: seller country to consignee, else buyer, country) when there is one, else the global band, else `None`. The mock table has global bands only, for the seven benchmark HS6 codes, so today every classified line of those goods gets a mock global band. `benchmarks_are_mock()` tells `/health` which table is in use.

### Score

`tbml.score.score(flags)` sums a weight per flag (high 40, medium 15, low 5), caps the total at 100, and maps it to a band: `review_now` from 60, `review` from 25, otherwise `low`. The weights and edges live in `backend/tbml/rules/config.yaml`.

### API

`backend/tbml/api.py` (`make api`, port 8000) wraps `check`:

| Route | Does |
|---|---|
| `POST /check` | Multipart PDF (`file`) in, `Report` out. Not a PDF: 400. Unreadable PDF: 400. Over 10 MB: 413. A PDF with no text layer: 200 with warnings. |
| `GET /reports/{invoice_id}` | The last report saved for that id, from `data/reports/` (`TBML_REPORTS_DIR` overrides). 404 if none. |
| `GET /samples` | The bundled synthetic invoices with their role and planted labels. |
| `POST /samples/{invoice_id}/check` | Runs one bundled sample without an upload. |
| `GET /health` | Status, schema version, whether stubs (`USE_MOCKS`) are on and whether bands are mock or real. |
| `GET /` | A small index of the API. |

Every successful check is saved to `data/reports/{invoice_id}.json`. CORS allows the Next.js dev server (`:3000`) and Vite's `:5173`.

## Cross-cutting design choices

- **Degrade, never fail.** Extraction falls back from cached LLM reply to live LLM to the layout parser to a minimal placeholder invoice. A line that cannot be classified or normalised keeps `None` fields and a note, and price rules skip it with a warning. Warnings end up in `Report.warnings`.
- **Offline by default.** With no `ANTHROPIC_API_KEY` and `LLM_MODEL`, extraction uses the deterministic layout parser and classification uses a keyword baseline. Tests never call the LLM.
- **Config over constants.** Every rule threshold, word list and scoring weight is in `rules/config.yaml`.
- **Explainability.** Each `Flag.reason` is written for a non-specialist and each `Flag.evidence` holds the raw numbers.
- **Synthetic data only.** Everything in `data/synthetic/` is fictional and labelled, so rules and extraction can be measured against known ground truth.

## Repository map

| Path | What is there |
|---|---|
| `backend/tbml/` | The Python package. See [backend/README.md](../backend/README.md). |
| `backend/tests/` | pytest suites per stage, golden fixtures in `fixtures/`. |
| `backend/scripts/` | Command-line tools: benchmark fetch, synthetic generation, evaluation placeholder. |
| `data/` | Reference tables, benchmark cache and the synthetic invoice set. See [data/README.md](../data/README.md). |
| `web/` | Next.js marketing site and demo workspace. See [web/README.md](../web/README.md). |
| `Makefile` | `setup`, `lint`, `test`, `format`, `api`, `web`, `data`, `synthetic`, `eval`. |

## The synthetic test set

`tbml.synthetic` generates invoices with planted anomalies (over and under pricing, implausible quantity, placeholder descriptions, geography contradictions, uneconomic routes, arithmetic errors, residential consignees), plus clean invoices and "hard negatives" that look suspicious but are legitimate. Each is rendered to PDF with one of three templates, with ground-truth JSON and label CSVs alongside. The same seed gives the same truth files. See [synthetic/README.md](../backend/tbml/synthetic/README.md).

## The web app

`web/` is a separate Next.js 15 project (React 19, Tailwind 4). It holds the public marketing site, a demo workspace with a fictional case dataset, and a route reserved for the real checker UI that will call the backend API. It does not import anything from `backend/`. See [web/README.md](../web/README.md).
