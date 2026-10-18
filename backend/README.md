# Backend

The `tbml` Python package: the invoice-checking pipeline, its data contracts, a synthetic invoice generator and a FastAPI app. For the big picture read [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Setup

From the repository root:

```bash
make setup   # creates .venv and installs this package with dev tools and the script extras
make lint
make test
```

Python 3.11 or newer. The API needs only the core dependencies; `pandas`, `requests`, `jinja2` and WeasyPrint are in the `scripts` extra (`pip install -e "backend[scripts]"`) for `fetch_benchmarks.py` and the synthetic generator, which keeps the deployed function small. WeasyPrint needs a few system libraries.

## Package layout

| Module | Purpose |
|---|---|
| `tbml/schemas.py` | The frozen data contracts (`Invoice`, `EnrichedLine`, `Benchmark`, `Flag`, `Report`). |
| `tbml/pipeline.py` | `check(pdf_path) -> Report`, chaining every stage. |
| `tbml/extract/` | PDF to `Invoice`. [README](tbml/extract/README.md) |
| `tbml/classify/` | Line to HS6 code and benchmark-unit price. [README](tbml/classify/README.md) |
| `tbml/benchmark/` | Price band lookup. |
| `tbml/rules/` | Red-flag rules R1 to R8. [README](tbml/rules/README.md) |
| `tbml/score/` | Flags to priority score and band. |
| `tbml/synthetic/` | Labelled synthetic invoice generator. [README](tbml/synthetic/README.md) |
| `tbml/api.py` | FastAPI app. |
| `tbml/asgi.py` | The deployed app: `tbml.api` mounted under `/api` (the Vercel entrypoint). |
| `tbml/paths.py` | Repository paths (`data/`, fixtures) and the cache root (`$TBML_CACHE_DIR`). |
| `tbml/fixtures.py` | Loads the golden JSON fixtures used by the stubs and tests. |
| `scripts/` | `fetch_benchmarks.py`, `generate_invoices.py`, `evaluate.py` (placeholder). |
| `tests/` | One test module per stage; `tests/rules/` has one file per rule. |

## Using it

```python
from tbml.pipeline import check

report = check("data/synthetic/pdfs/INV-2024-0002.pdf")
print(report.priority_band, [f.rule for f in report.flags])
```

Extract only, with the offline parser:

```bash
python -m tbml.extract some.pdf --no-llm        # Invoice JSON
python -m tbml.extract some.pdf --raw           # the text the parser sees
python -m tbml.extract.scoring                  # extraction accuracy over data/synthetic
```

## Environment variables

| Variable | Effect |
|---|---|
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | Both set: extraction and classification use the LLM (cached on disk). Either missing: offline paths. Also read from a repo-root `.env`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Preferred provider: used instead of Anthropic when both are set. |
| `SUMMARY_MODEL` | Optional model for `Report.summary` only (e.g. a flash-lite or haiku-class model). Default: the main model. With no provider the summary is a fixed template. |
| `TBML_CACHE_DIR` | Where extraction caches LLM replies (default `data/cache`). |
| `COMTRADE_API_KEY` | Used only by `scripts/fetch_benchmarks.py`. |

## Tests

`make test` runs the whole suite. Tests never reach the network or an LLM: `tests/conftest.py` removes the API key. Rule tests build small invoices in `tests/rules/rules_helpers.py`; end-to-end checks run the rules over the synthetic set.
