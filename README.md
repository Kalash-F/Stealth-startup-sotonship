# TBML Invoice Checker

Helps trade finance compliance officers catch trade-based money laundering (TBML) by checking invoice line items against trade price benchmarks and document red-flag rules, then producing a prioritised, explained review report. The output is a review priority with reasons, never a fraud verdict.

`plan.md` is the build plan and single source of truth. `PROGRESS.md` logs work; `DECISIONS.md` logs deviations.

## Quick start

```bash
make setup     # .venv + pip install -e backend[dev]
make lint
make test
source .venv/bin/activate
python -c "from tbml.pipeline import check; print(check('any.pdf').priority_band)"
```

| Target | What it does |
|---|---|
| `make setup` | create `.venv`, install the backend package and dev tools |
| `make test` / `make lint` / `make format` | pytest / ruff check + format check / auto-fix |
| `make api` | FastAPI on :8000 with reload (real pipeline; `USE_MOCKS=1 make api` for the fixture stubs). Endpoints: `GET /health`, `POST /check` (multipart `file`), `GET /reports/{invoice_id}`, `GET /samples`, `POST /samples/{invoice_id}/check` |
| `make web` | Vite dev server in `web/` |
| `make data` | fetch and cache benchmark data (`backend/scripts/fetch_benchmarks.py`) |
| `make synthetic` | regenerate the synthetic invoice set (`SEED=42 N=60` by default) |
| `make eval` | evaluation (Phase 6) |

## Deploy (Vercel)

`vercel.json` deploys the repo as one Vercel project with two services on one domain:

| Service | Root | Public path |
|---|---|---|
| `backend` (FastAPI, entrypoint `tbml/asgi.py`) | `backend/` | `/api/*`, e.g. `/api/health`, `/api/check` |
| `web` (Next.js) | `web/` | everything else |

Vercel forwards the full URL, so `tbml/asgi.py` mounts the API under `/api`; `make api` serves the same app without the prefix. Run `vercel dev` from the repo root to run both services together on the deployed paths.

The backend function is bundled from `backend/` alone and Vercel caps its size, so:

- Only the API's own dependencies are installed. `pandas`, `requests`, `jinja2` and WeasyPrint live in the `scripts` extra, and the band tables are JSON (`data/benchmarks/bands*.json`), read without pandas.
- The backend's build step copies `data/` into `backend/data/`, and `tbml/paths.py` falls back to that copy.
- The deployed filesystem is read-only apart from the temp dir, so `tbml/asgi.py` points the LLM caches and saved reports there. They last only as long as the function instance, so `GET /api/reports/{id}` can miss a report made on another instance.

`vercel build` reproduces the deployment build locally. See `DECISIONS.md` DV1 to DV3.

## Layout

- `backend/tbml/schemas.py`: the data contracts (plan §4), `SCHEMA_VERSION = "1.1"`.
- `backend/tbml/{extract,classify,benchmark,rules,score}/`, `pipeline.py`, `api.py`: pipeline stages.
- `backend/tbml/synthetic/`: synthetic invoice generator and HTML templates.
- `data/synthetic/`: generated, labelled synthetic invoices (fictional companies, clearly marked synthetic).
- `data/reference/`: HS code list (`hs.db`), exchange rates, unit weights, country and city lists.
- `data/benchmarks/`: price bands (`bands.json`, real) and the raw HMRC responses they are built from.

## Results

`make eval` writes `reports/eval/summary.md`. With the committed data and cached model answers:

- **Classification** on 44 realistic invoice descriptions (`data/eval/descriptions.csv`): keyword baseline 26/39 correct (67%); three-step AI classifier with `google/gemini-2.5-flash` 37 to 39/39 across runs (95-100%), never confidently wrong, and all 5 vague lines left unclassified.
- **Detection** on the 60 synthetic invoices, priced against the real bands: 17 of 18 anomalous invoices flagged, 0 of 36 clean and 0 of 6 legitimate-but-unusual invoices flagged. Reviewing the top 20% by priority catches 67% of anomalies, against 20% for random spot-checks; the top 30% catches all of them.

The invoices and their anomalies are synthetic and planted by our own generator, so these numbers show the system works as designed, not real-world performance.

## Data sources

| Data | Source | Date | Licence |
|---|---|---|---|
| Price bands (`data/benchmarks/bands.json`) | HMRC Overseas Trade Statistics via the uktradeinfo OTS API: UK imports of the 7 benchmark goods, 2023-2025, unit value per partner country, port and month | Fetched 2026-10-17; HMRC figures are provisional for up to 18 months | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) |
| Raw responses behind the bands (`data/benchmarks/raw/hmrc_*.json.gz`) | Same as above, unmodified | Fetched 2026-10-17 | Open Government Licence v3.0 |
| HS code list (`data/reference/hs.db`) | UN Comtrade reference list, classification "HS" (Combined HS) | Retrieved 2026-10-17 | UN Comtrade terms of use (free reference data, attribution) |
| Exchange rates (`data/reference/fx.csv`, `fx_annual.csv`) | US Federal Reserve G.5A annual averages (GBP, EUR, CNY), 2022-2025; AED from the Central Bank of the UAE peg (3.6725). CZK is approximate and unused by any test invoice | Retrieved 2026-10-17 | US government work, public domain |
| Screw unit weights (`data/reference/unit_weights.csv`) | Calculated from steel density and bolt dimensions; working shown in each row | 2026-10-17 | Ours |
| Invoices (`data/synthetic/`) | Generated by `backend/scripts/generate_invoices.py`; every company, person and address is fictional, every PDF says "SYNTHETIC TEST DOCUMENT" | Generated 2026-10-17 | Ours |
| Evaluation descriptions (`data/eval/descriptions.csv`) | Written by us; true HS codes checked against `hs.db` | 2026-10-17 | Ours |

No real customer data is used anywhere. The Comtrade fetch path in `fetch_benchmarks.py` works with a free key (see `docs/INVESTIGATION-trade-data-sources.md`) but its raw responses (1.1 GB) are not committed, so the committed bands are HMRC only. Rebuild them offline with `python backend/scripts/fetch_benchmarks.py --from-raw`.

## AI use and who did what

- **In the product:** the HS classifier calls an LLM through OpenRouter (`google/gemini-2.5-flash` by default; `tbml/llm.py`). Model answers are cached in `data/cache/` so the demo and `make eval` reproduce offline. Without a key, the app falls back to keyword matching and says so.
- **AI-generated code:** most of this repository was written with AI coding assistants (Claude Code and Claude), directed, reviewed and tested by the team. Commits made with an assistant carry a `Co-Authored-By` trailer. `plan.md`, `DECISIONS.md` and `PROGRESS.md` record what was built and why.
- **Team:** Arqam (classifier, OpenRouter integration, evaluation, checker page), Ali (HS code list), Anveet (trade data investigation and fetch fixes), Kalash (backend pipeline, website, Vercel deploy), Faisal.
- **Built during SotonShip 2026** (16-18 October 2026); the repository was created after hacking opened.
