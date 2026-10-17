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

## Layout

- `backend/tbml/schemas.py`: the data contracts (plan §4), `SCHEMA_VERSION = "1.0"`.
- `backend/tbml/{extract,classify,benchmark,rules,score}/`, `pipeline.py`, `api.py`: pipeline stages.
- `backend/tbml/synthetic/`: synthetic invoice generator and HTML templates.
- `data/synthetic/`: generated, labelled synthetic invoices (fictional companies, clearly marked synthetic).
- `data/reference/`: FX table and placeholder price bands.

All invoice data in this repo is synthetic. Benchmark values marked `is_mock` are approximations, not real trade statistics.
