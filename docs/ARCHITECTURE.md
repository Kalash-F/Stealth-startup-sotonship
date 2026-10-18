# Architecture

How the TBML Invoice Checker works, stage by stage. `plan.md` is the build plan, `DECISIONS.md` records where the code deviates from it, and `PROGRESS.md` is the work log. This file explains the code as it stands.

For an interactive diagram of the whole system (web app, API, pipeline stages, LLM, caches and data files), open [architecture.html](architecture.html) in a browser; its source spec is [architecture.json](architecture.json).

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

`check` then merges each `LineItem`, its `EnrichedLine` and its `Benchmark` into a `ReportLine`, adds the extraction warnings, and returns a `Report`.

### Data contracts

All of them live in `backend/tbml/schemas.py` (`SCHEMA_VERSION = "1.0"`). They are frozen: changing one means bumping the version, updating every producer, consumer and fixture, and logging it in `DECISIONS.md`. Unknown fields are rejected, so drift fails loudly. Golden examples are in `backend/tests/fixtures/`.

- `Invoice`: header fields, three `Party` objects (seller, buyer, optional consignee) and a list of `LineItem`, exactly as printed. Numbers are never corrected here, because a wrong total is itself a finding.
- `EnrichedLine`: HS6 code (or `None`), up to three candidates, confidence, and the quantity and USD price converted to the benchmark unit.
- `Benchmark`: a USD-per-unit price band (p10, p25, median, p75, p90) for an HS6, globally or for an `ORIGIN-DEST` route, with an `is_mock` marker.
- `Flag`: rule, line (or invoice level), severity, expected versus stated, a reason, and an `evidence` dict.
- `Report`: priority score and band, flags, enriched lines with their bands, timing and warnings.

### Benchmark

Prices are checked against bands of historical trade unit values (UN Comtrade and HMRC), cached in `data/benchmarks/` as JSON so the runtime never calls an API (and needs no pandas). `backend/scripts/fetch_benchmarks.py` builds the cache. Without network access it writes `bands_mock.json`, approximate stand-ins marked `is_mock=True`, and every reason that relies on them says so. Route-specific bands win over global ones when they have enough observations.

On `main` today, `tbml.benchmark` is still the Phase 0 stub that returns the fixture band when the HS6 matches. The Phase 5 pull request (#8) replaces it with the band-table lookup and adds the full API, so the stage described above is the intended behaviour once that merges.

### Score

`tbml.score.score(flags)` sums a weight per flag (high 40, medium 15, low 5), caps the total at 100, and maps it to a band: `review_now` from 60, `review` from 25, otherwise `low`. The weights and edges live in `backend/tbml/rules/config.yaml`.

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
| `vercel.json` | Vercel deployment: `backend` and `web` as services of one project, `/api/*` to the backend, everything else to the web app. |

## The synthetic test set

`tbml.synthetic` generates invoices with planted anomalies (over and under pricing, implausible quantity, placeholder descriptions, geography contradictions, uneconomic routes, arithmetic errors, residential consignees), plus clean invoices and "hard negatives" that look suspicious but are legitimate. Each is rendered to PDF with one of three templates, with ground-truth JSON and label CSVs alongside. The same seed gives the same truth files. See [synthetic/README.md](../backend/tbml/synthetic/README.md).

## The web app

`web/` is a separate Next.js 15 project (React 19, Tailwind 4). It holds the public marketing site, a demo workspace with a fictional case dataset, and a route reserved for the real checker UI that will call the backend API. It does not import anything from `backend/`. See [web/README.md](../web/README.md).
