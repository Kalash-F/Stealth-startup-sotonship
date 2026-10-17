# PROGRESS

Append-only. Format: `[YYYY-MM-DD HH:MM] [phase.task] [owner P1–P4] DONE|FAIL|BLOCKED — summary — evidence`

[2026-10-17 03:36] [0.1] [All] DONE — repo layout (backend/, data/, reports/; web/ owned by the website thread) + Makefile targets setup/test/lint/api/web/data/eval (+format, synthetic) — Makefile
[2026-10-17 03:36] [0.2] [All] DONE — .env.example with ANTHROPIC_API_KEY, LLM_MODEL, COMTRADE_API_KEY — .env.example
[2026-10-17 03:36] [0.3] [All] DONE — all §4 contracts in schemas.py, SCHEMA_VERSION "1.0" — backend/tbml/schemas.py
[2026-10-17 03:36] [0.4] [All] DONE — 7 golden fixtures (party, line_item, invoice, enriched_line, benchmark, flag, report), synthetic/mock-labelled — backend/tests/fixtures/
[2026-10-17 03:37] [0.5] [All] DONE — test_schemas.py: fixtures validate + roundtrip; missing field, unknown field, wrong type, bad enum/range rejected; field names asserted against §4 — 56 tests
[2026-10-17 03:37] [0.6] [All] DONE — stubs extract/enrich/benchmark/run_rules/score + pipeline.check + stub API — test_pipeline_stubs.py 3 tests
[2026-10-17 03:37] [0.7] [All] DONE — PROGRESS.md, DECISIONS.md created — repo root
[2026-10-17 03:38] [CHECKPOINT 0] [All] DONE — make setup OK; make lint: "All checks passed!", "14 files already formatted"; make test: "60 passed in 0.34s"; check('any.pdf') -> Report INV-2024-0001, score 80.0, review_now, 2 flags, 2 lines, built entirely from stubs. Criteria: (1) lint clean + all tests pass: yes. (2) check() returns a valid Report from stubs: yes, re-validated via model_validate_json in test. (3) every §4 schema has a fixture + validation test: yes, 7/7. (4) field names match §4: checked field by field and asserted in test_field_names_match_plan. §4 re-read: no drift; interpretations logged as D0.4–D0.8.
