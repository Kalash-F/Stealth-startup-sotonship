# TBML Invoice Checker

Helps trade finance compliance officers catch trade-based money laundering (TBML) by checking invoice line items against trade price benchmarks and document red-flag rules, then producing a prioritised, explained review report. The output is a review priority with reasons, never a fraud verdict.

`plan.md` is the build plan and single source of truth. `PROGRESS.md` logs work; `DECISIONS.md` logs deviations.

## Quick start

```bash
make setup     # .venv + pip install -e backend[dev]
make lint
make test
source .venv/bin/activate
python -c "from tbml.pipeline import check; print(check('data/synthetic/pdfs/INV-2024-0002.pdf').priority_band)"
```

| Target | What it does |
|---|---|
| `make setup` | create `.venv`, install the backend package and dev tools |
| `make test` / `make lint` / `make format` | pytest / ruff check + format check / auto-fix |
| `make api` | FastAPI on :8000 with reload (real pipeline; `USE_MOCKS=1 make api` for the fixture stubs). Endpoints: `GET /` (index), `GET /health`, `POST /check` (multipart `file`), `GET /reports/{invoice_id}`, `GET /samples`, `POST /samples/{invoice_id}/check` |
| `make web` | Next.js dev server in `web/` on :3000 |
| `make data` | fetch and cache benchmark data (`backend/scripts/fetch_benchmarks.py`) |
| `make synthetic` | regenerate the synthetic invoice set (`SEED=42 N=60` by default) |
| `make eval` | evaluation; a placeholder until Phase 6 is built |

## Layout

- `backend/tbml/schemas.py`: the data contracts (plan §4), `SCHEMA_VERSION = "1.0"`.
- `backend/tbml/{extract,classify,benchmark,rules,score}/`, `pipeline.py`, `api.py`: pipeline stages and the FastAPI app.
- `backend/tbml/synthetic/`: synthetic invoice generator and HTML templates.
- `backend/scripts/`: `fetch_benchmarks.py`, `generate_invoices.py`, `evaluate.py` (placeholder).
- `data/synthetic/`: generated, labelled synthetic invoices (fictional companies, clearly marked synthetic).
- `data/reference/`: HS6 list, unit weights, FX tables, countries and cities, placeholder price bands.
- `data/benchmarks/`: cached price bands (`bands_mock.parquet` until real data is fetched).
- `web/`: Next.js 15 marketing site and demo workspace (see `web/README.md`). It does not call the backend yet.
- `docs/ARCHITECTURE.md`: how the pipeline works, stage by stage.

All invoice data in this repo is synthetic. Benchmark values marked `is_mock` are approximations, not real trade statistics.
