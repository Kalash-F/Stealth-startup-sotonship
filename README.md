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

- `backend/tbml/schemas.py`: the data contracts (plan §4), `SCHEMA_VERSION = "1.0"`.
- `backend/tbml/{extract,classify,benchmark,rules,score}/`, `pipeline.py`, `api.py`: pipeline stages.
- `backend/tbml/synthetic/`: synthetic invoice generator and HTML templates.
- `data/synthetic/`: generated, labelled synthetic invoices (fictional companies, clearly marked synthetic).
- `data/reference/`: FX table and placeholder price bands.

All invoice data in this repo is synthetic. Benchmark values marked `is_mock` are approximations, not real trade statistics.
