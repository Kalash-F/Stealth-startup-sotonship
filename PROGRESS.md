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
[2026-10-17 03:42] [1.1] [P4] DONE — 3 Jinja2 templates (classic / modern / trade) with different layouts, fonts, labels and date formats — backend/tbml/synthetic/templates/
[2026-10-17 03:46] [1.2] [P4] DONE — generate_invoices.py --seed --n --out --bands --no-pdf; fictional parties; routes from §5.2; 1–5 lines from §5.1; clean prices in p25–p75 of placeholder bands; PDFs + truth JSON + labels.csv (+ lines.csv, invoices.csv, D1.4) — backend/scripts/generate_invoices.py
[2026-10-17 03:46] [1.3] [P4] DONE — 18/60 invoices anomalous (30%), all 8 types planted 4× each — data/synthetic/labels.csv
[2026-10-17 03:46] [1.4] [P4] DONE — 6/60 hard negatives (10%): 2 premium near p90, 2 bulk near p10, 2 explained unusual routes; CLEAN_HARD in hard_negative column — data/synthetic/labels.csv
[2026-10-17 03:47] [1.5] [P4] DONE — test_synthetic.py 17 tests: byte-identical rerun, committed data == generator output, truth validates as Invoice, counts ≥ 4, planted arithmetic fails R6 tolerance, everything else exact, planted prices sit where labels say, placeholder hs6 null, residential/geo only where planted, PDFs text-selectable — 17 passed
[2026-10-17 03:49] [1.6] [P4] DONE — visual check of 5 random PDFs (random.Random(11).sample): PI-0041-24 (modern, ARITHMETIC_ERROR+UNDER_PRICE), TX240048 (trade, bulk hard negative), PI-0054-24 (modern, clean), TX240047 (trade, clean), TX240059 (trade, clean). All look like real commercial invoices; the three templates are clearly different; pdfplumber extracts all text. Earlier rounds of this check found and fixed UK postcodes not matching the city (Leeds "M97") and Chinese districts in the wrong city (Beilun in Shenzhen); templates otherwise unchanged.
[2026-10-17 03:49] [CHECKPOINT 1] [P4] DONE — `generate_invoices.py --seed 42 --n 60` → 60 PDFs, 60 truth files, labels.csv present. Rerun to /tmp/rerun: `diff -r data/synthetic/truth /tmp/rerun/truth` and labels.csv diff both empty. make test: "77 passed in 3.40s" (Phase 0 tests still green); make lint clean. 5 PDFs inspected (1.6). §4 re-read: generator emits `Invoice` via schemas.py, no drift. Anomaly distribution:
    | Label | Count |
    |---|---|
    | OVER_PRICE | 4 |
    | UNDER_PRICE | 4 |
    | QTY_VALUE_IMPLAUSIBLE | 4 |
    | PLACEHOLDER_DESC | 4 |
    | GEO_INCONSISTENT | 4 |
    | ROUTE_NO_ECONOMIC_SENSE | 4 |
    | ARITHMETIC_ERROR | 4 |
    | RESIDENTIAL_CONSIGNEE | 4 |
    Roles: clean 36, anomalous 18, hard_negative 6, total 60. Flags for next checkpoints: bands and FX are placeholders (D1.2, D1.3); ROUTE planting assumes copper/coffee price parity (D1.7); R4 must accept explained re-exports (D1.8).
[2026-10-17 11:10] [3.6-3.11, 3.13] [P2] DONE — Classification and normalisation in `tbml/classify/`: hs6.csv (31 codes, unverified, D3.2), placeholder detector, cached Anthropic proposer + offline keyword baseline, validation against hs6.csv, null below 0.5, unit_weights.csv, FX/unit conversion with mandatory note. On the 60 synthetic invoices (147 lines): all non-placeholder lines classified correctly, all 4 placeholder lines null, normalised quantity and USD price match generator truth within 0.1%. Also repaired main (D3.1). `make lint` clean; `make test`: 149 passed. Not done: 3.6 official HS6 list and HS6 verification (no network), live-LLM run, and regenerating the synthetic set with real bands (3A bands are still mock).
[2026-10-17 12:30] [5.1-5.7] [P1] DONE — real benchmark lookup, pipeline on run_rules_with_warnings, USE_MOCKS stubs, /health /check /reports /samples, report cache, 400/413 handling, CORS, test_api.py 11 tests — backend/tbml/{api,pipeline,benchmark,stubs}.py
[2026-10-17 12:30] [CHECKPOINT 5] [P1] DONE — make lint clean; make test green; `make api` + curl: /health ok (benchmarks mock), PI-0035-24 (OVER_PRICE) -> PRICE_OUTLIER high on L1, review_now, 73 ms; all 36 clean + 6 hard-negative invoices low; median 0.08 s/invoice offline. Not verified: LLM extraction path (no API key). Flag: INV-2024-0009 ROUTE miss from mock-vs-placeholder band mismatch (D5.3).
[2026-10-17 20:45] [7.x] [Arqam] DONE — hierarchical HS classifier (chapter -> heading -> HS6), nomenclature loader, CLASSIFIER switch, path in note; 11 new tests with a fake model, 313 passed, lint clean. Not done: live run with a key, Ali's full HS list (not on GitHub yet) — backend/tbml/classify/{hierarchical,nomenclature}.py
[2026-10-17 21:05] [7.x] [Arqam] DONE — OpenRouter client (tbml/llm.py) used by extraction and both classifiers; Anthropic kept as fallback; /health shows provider; 14 new tests (fake HTTP), 327 passed, lint clean. Not done: live run (key pending).
[2026-10-17 21:20] [7.x] [Arqam] DONE — merged Ali's graphs-&-hs6-data (hs.db, HS.json, SQL, scripts); nomenclature reads hs.db; chapters 77/99 excluded; 329 passed, lint clean.
[2026-10-17 21:35] [7.x] [Arqam] DONE — deploy-safe: hs.db moved to data/reference/, OpenRouter client on stdlib urllib (no requests); 330 passed, lint clean. Branch still conflicts with claude/admiring-mayer-lydv9e in proposers.py, extract/llm.py, DECISIONS, PROGRESS.
[2026-10-17 19:50] [deploy] [All] DONE — Vercel deploy fixed: bands parquet -> JSON and offline-only deps moved to the `scripts` extra (DV1), data/ copied into the backend bundle (DV2), caches and reports in the temp dir when data/ is read-only (DV3) — `vercel build` (CLI 64.5.0) succeeded, backend function ~81 MB (was 325 MB, LAMBDA_SIZE_EXCEEDED); built function run read-only as a non-root user: /api/health, /api/samples, /api/samples/PI-0035-24/check (same report as local), /api/check upload, /api/reports/{id}, /api/docs all OK, non-PDF 400; make lint clean; make test 305 passed
[2026-10-17 21:55] [7.x] [Arqam] DONE — merged main (deploy fix) into feature/hierarchical-classifier, conflicts resolved, cache read-only-safe, verified in a deploy-only venv; 336 passed, lint clean.
[2026-10-17 22:30] [6+7] [Arqam] DONE — evaluate.py (Part A classification, Part B detection + review budget), data/eval/descriptions.csv, /app/checker page wired to the API with dev proxy; browser-tested sample + upload, prod build OK; 338 passed, lint clean. LLM numbers pending: OpenRouter blocked from the build sandbox.
[2026-10-17 22:55] [6] [Arqam] DONE — live eval on OpenRouter: gemini-2.5-flash 3-step 39/39 (37-39 across runs) vs keyword 26/39; interpretation step, code normalisation; Gemini-only cache committed; 343 passed, lint clean.
