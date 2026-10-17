# TBML Invoice Checker — see plan.md §3 and README.md.
VENV ?= .venv
PY := $(VENV)/bin/python
SEED ?= 42
N ?= 60

.PHONY: setup test lint format api web data hs-codes synthetic eval

setup:
	python3 -m venv $(VENV)
	$(PY) -m pip install --upgrade pip
	$(PY) -m pip install -e "backend[dev]"

test:
	$(PY) -m pytest backend/tests

lint:
	$(PY) -m ruff check backend
	$(PY) -m ruff format --check backend

format:
	$(PY) -m ruff check --fix backend
	$(PY) -m ruff format backend

api:
	$(VENV)/bin/uvicorn tbml.api:app --reload --port 8000

web:
	cd web && npm install && npm run dev

data:
	$(PY) backend/scripts/fetch_benchmarks.py

hs-codes:
	$(PY) backend/scripts/fetch_hs_codes.py --db hs.db

synthetic:
	$(PY) backend/scripts/generate_invoices.py --seed $(SEED) --n $(N)

eval:
	$(PY) backend/scripts/evaluate.py
