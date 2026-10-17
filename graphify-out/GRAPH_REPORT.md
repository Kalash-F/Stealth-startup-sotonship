# Graph Report - Stealth-startup-sotonship  (2026-10-17)

## Corpus Check
- 162 files · ~60,365 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 5, .example 1, .css 1)

## Summary
- 1325 nodes · 3693 edges · 68 communities (64 shown, 4 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 208 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Pipeline and Benchmark
- Unit and FX Normalisation
- Marketing and Domain UI
- Extraction Finalise and Address
- Rule Shared Helpers
- Extraction Tests
- App Shell and Nav
- Rule Test Builders
- Overview Charts
- Case View Tabs
- Entity Graph Explorer
- Priority Scoring
- Synthetic Catalogue and Generator
- Template Layout Parsers
- Entity Detail Panels
- Extraction Accuracy Scoring
- Severity and R1 Tests
- Forms and Request Demo
- CLI Entry Points
- Synthetic Dataset Tests
- Investigation List Filters
- Placeholder and Classify Tests
- Golden Fixtures
- Geo Lookup Helpers
- Transactions and Funds Flow
- Benchmark Fetch Script
- HS6 Reference and Classifier
- Web Tooling Deps
- Status Badges
- Workspace Route Pages
- TypeScript Config
- Generator Script and Paths
- Residential Consignee R7
- Web Runtime Deps
- Web Data Types
- Synthetic CSV Outputs
- Sign-in and Previews
- Analyst Notes and Queue
- Enrich and Keyword Proposer
- LLM Structuring
- Proposer Protocol
- PDF Rendering
- Root Layout and Fonts
- Site Layout and Header
- Geo Rule Tests
- FastAPI App
- Web Dev Deps
- LLM Reply Cache
- Fictional Party Factory
- Country Lookup
- Anthropic Client
- Cached Proposer
- Playwright Smoke Tests
- HMRC Records and FX
- Anthropic Proposer
- Proposer Errors
- Parsing Unit Tests
- npm Scripts
- Case Page Route
- ESLint Config
- Band Computation
- Extract Wrapper
- LLM Client Protocol
- Rules Config Loader
- Extraction Result
- tbml Package Root

## God Nodes (most connected - your core abstractions)
1. `cn()` - 98 edges
2. `Invoice` - 67 edges
3. `Severity` - 54 edges
4. `Rule` - 43 edges
5. `Benchmark` - 41 edges
6. `EnrichedLine` - 40 edges
7. `extract_document()` - 39 edges
8. `Flag` - 36 edges
9. `next` - 35 edges
10. `make_invoice()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `test_every_output_validates_as_invoice()` --uses--> `Invoice`  [INFERRED]
  backend/tests/test_extract.py → backend/tbml/schemas.py
- `test_every_truth_file_validates_as_invoice()` --uses--> `Invoice`  [INFERRED]
  backend/tests/test_synthetic.py → backend/tbml/schemas.py
- `test_every_flag_validates_and_explains_itself()` --uses--> `Flag`  [INFERRED]
  backend/tests/test_rules_on_synthetic.py → backend/tbml/schemas.py
- `check()` --uses--> `Report`  [INFERRED]
  backend/tbml/api.py → backend/tbml/schemas.py
- `enrich()` --uses--> `Proposer`  [INFERRED]
  backend/tbml/classify/__init__.py → backend/tbml/classify/proposers.py

## Import Cycles
- None detected.

## Communities (68 total, 4 thin omitted)

### Community 0 - "Pipeline and Benchmark"
Cohesion: 0.07
Nodes (63): benchmark(), P2: price bands from cache. Phase 0 stub: the fixture band when the HS6 matches., TBML invoice checker backend., check(), Path, Chains every stage: PDF -> Invoice -> EnrichedLine -> Benchmark -> Flag ->…, check(), _off() (+55 more)

### Community 1 - "Unit and FX Normalisation"
Cohesion: 0.06
Nodes (43): benchmark_units(), load_fx(), load_unit_weights(), normalise(), Normalised, _pack_count(), Printed quantity and price -> benchmark unit and USD (plan 3.9, 3.10). Never…, Pieces per pack from wording like 'carton of 24' or 'box x 100', else None. (+35 more)

### Community 2 - "Marketing and Domain UI"
Cohesion: 0.09
Nodes (39): FlagItem(), severityOrder, PriceBandBar(), CaseStatusLabel(), evidenceClassMeta, EvidenceClassTag(), PriorityScore(), Capabilities() (+31 more)

### Community 3 - "Extraction Finalise and Address"
Cohesion: 0.08
Nodes (39): classify_address(), Address type heuristics (plan.md 2.3). Returns None when the keywords are not…, Keyword verdict on a party. Order matters: P.O. box -> unknown, residential…, _finalise(), _minimal(), P1: PDF -> Invoice (plan.md Phase 2). `extract(pdf)` returns an `Invoice`.…, Keyword heuristics decide address_type when they are decisive; otherwise keep…, Heuristic address types, and a check that every number really is in the… (+31 more)

### Community 4 - "Rule Shared Helpers"
Cohesion: 0.09
Nodes (39): fmt_money(), fmt_num(), fmt_ratio(), mock_note(), paired(), product_name(), Shared helpers for the rule files: config, flag construction, number…, Benchmark unit in words a non-specialist reads easily ('u' means one item). (+31 more)

### Community 5 - "Extraction Tests"
Cohesion: 0.11
Nodes (34): extract_document(), Extract an Invoice from a PDF, trying cached LLM reply, LLM, layout parser,…, FakeClient, layout_results(), no_real_llm(), _pdf(), fixture, Phase 2: PDF -> Invoice. Accuracy against the 60 synthetic truth files, LLM… (+26 more)

### Community 6 - "App Shell and Nav"
Cohesion: 0.08
Nodes (31): @radix-ui/react-dialog, react, metadata, AppShell(), isActive(), nav, NavLinks(), CaseActions() (+23 more)

### Community 7 - "Rule Test Builders"
Cohesion: 0.14
Nodes (34): make_band(), make_enriched(), make_invoice(), make_line(), Any, Builders for rule tests: a clean one-line invoice, enrichment and band that no…, test_missing_enrichment_treated_as_unclassified(), run() (+26 more)

### Community 8 - "Overview Charts"
Cohesion: 0.09
Nodes (30): recharts, InvestigationsPage(), metadata, OverviewPage(), CorridorChart(), data, largest(), Row (+22 more)

### Community 9 - "Case View Tabs"
Cohesion: 0.13
Nodes (26): @radix-ui/react-tabs, SessionEvent, SessionNote, tabs, TabValue, classOrder, SummaryTab(), Ev (+18 more)

### Community 10 - "Entity Graph Explorer"
Cohesion: 0.10
Nodes (30): hrefFor(), NetworkTab(), EntityDetail(), EntityExplorer(), nodes, EntityGraph(), EntityGraphProps, GraphLegend() (+22 more)

### Community 11 - "Priority Scoring"
Cohesion: 0.10
Nodes (28): PriorityBand, Review urgency derived from the priority score: never a fraud verdict., Rule types R1–R8 (plan.md Phase 4 §4.2)., Rule, P3: combine flags into a priority score and band (plan.md 4.4)., Weighted sum of flag severities, capped; weights, cap and band edges come from…, score(), flag() (+20 more)

### Community 12 - "Synthetic Catalogue and Generator"
Cohesion: 0.09
Nodes (26): Commodity, Static vocabulary for the synthetic invoice generator: products, routes,…, One way a commodity appears on an invoice line., A product the generator can sell: HS6, name, benchmark unit and how it appears…, Variant, _generate_one(), price_lines(), Line (+18 more)

### Community 13 - "Template Layout Parsers"
Cohesion: 0.12
Nodes (27): _cells(), _find(), LayoutError, _lines(), _none_if_missing(), _parse_classic(), after_label(), _parse_modern() (+19 more)

### Community 14 - "Entity Detail Panels"
Cohesion: 0.14
Nodes (23): InvoiceTab(), Connections(), EntityBody(), NodeBody(), SelectFn, EntityDirectory(), resolve(), Selection (+15 more)

### Community 15 - "Extraction Accuracy Scoring"
Cohesion: 0.10
Nodes (25): compare(), _eq(), _eq_value(), FieldResult, main(), norm(), _party(), Field-level comparison of an extracted `Invoice` against ground truth (plan.md… (+17 more)

### Community 16 - "Severity and R1 Tests"
Cohesion: 0.14
Nodes (24): How strongly a flag asks for attention. Scoring turns these into points., Severity, _no_live_llm(), fixture, Tests never call the LLM: default_proposer() falls back to the offline baseline., parametrize, run(), test_exactly_on_band_edge_is_not_flagged() (+16 more)

### Community 17 - "Forms and Request Demo"
Cohesion: 0.11
Nodes (18): covers, metadata, emptyValues, Errors, Field, fieldOrder, RequestForm(), onSubmit() (+10 more)

### Community 18 - "CLI Entry Points"
Cohesion: 0.12
Nodes (17): Evaluation (plan.md Phase 6). Not built yet; exists so `make eval` has a target., main(), python -m tbml.extract <file.pdf> [--no-llm] [--raw]: print the extracted…, Parse arguments, run extraction, print the Invoice JSON to stdout and…, file_sha256(), Path, Plan 2.1: PDF -> text, tables and positioned words (pdfplumber)., One page: size, plain text, positioned words and any tables pdfplumber found. (+9 more)

### Community 19 - "Synthetic Dataset Tests"
Cohesion: 0.12
Nodes (13): _arith_breaks_tolerance(), _arith_line_ok(), bands(), items(), labels(), fixture, Phase 1: the synthetic dataset is reproducible, valid, and its labels are true., _rows() (+5 more)

### Community 20 - "Investigation List Filters"
Cohesion: 0.15
Nodes (18): bands, InvestigationList(), parties(), SortHeader(), statuses, CaseFilters, DEFAULTS, SortDir (+10 more)

### Community 21 - "Placeholder and Classify Tests"
Cohesion: 0.22
Nodes (18): classify_description(), Pick an HS6 code for a description. Placeholder wording is rejected before the…, is_placeholder(), True if every token is filler, a number or a single character (or there are no…, FakeProposer, parametrize, Tasks 3.7, 3.8, 3.11: classification against synthetic truth and the validation…, test_cache_makes_second_run_free_and_deterministic() (+10 more)

### Community 22 - "Golden Fixtures"
Cohesion: 0.17
Nodes (17): load_fixture(), Any, Load golden fixtures from backend/tests/fixtures. Used by the Phase 0 stubs., Return the parsed JSON of `backend/tests/fixtures/{name}.json`., parametrize, Every §4 contract has a golden fixture that validates, and bad inputs are…, test_bad_enum_or_range_rejected(), test_field_names_match_plan() (+9 more)

### Community 23 - "Geo Lookup Helpers"
Cohesion: 0.17
Nodes (19): _compile(), find_cities(), find_countries(), normalise(), _patterns(), place_country(), Pattern, Place-name lookups for R4/R5: country names and aliases, and a city -> country… (+11 more)

### Community 24 - "Transactions and Funds Flow"
Cohesion: 0.21
Nodes (17): CaseRail(), entityLink(), FundsFlow(), pct(), TransactionsTab(), TxList(), PatternCallout(), FeaturedCase() (+9 more)

### Community 25 - "Benchmark Fetch Script"
Cohesion: 0.14
Nodes (18): argparse, cache_raw(), comtrade_records(), fetch_comtrade(), fetch_hmrc(), main(), mock_bands(), Fetch trade data, compute unit-value price bands, write… (+10 more)

### Community 26 - "HS6 Reference and Classifier"
Cohesion: 0.15
Nodes (15): Classification, Description -> HS6 (plan 3.7, 3.8)., Outcome of classifying one description. `hs6` is None when no code could be…, default_hs6(), HS6Entry, load_hs6(), Path, Reference list of valid HS6 codes (data/reference/hs6.csv). (+7 more)

### Community 27 - "Web Tooling Deps"
Cohesion: 0.11
Nodes (18): class-variance-authority, clsx, eslint, eslint-config-next, @radix-ui/react-dropdown-menu, @radix-ui/react-slot, react-dom, tailwind-merge (+10 more)

### Community 28 - "Status Badges"
Cohesion: 0.16
Nodes (14): lucide-react, bandGlyph, bandTone, severityIcon, SeverityTag(), severityTone, statusColor, statusIcon (+6 more)

### Community 29 - "Workspace Route Pages"
Cohesion: 0.13
Nodes (9): next, nextConfig, metadata, metadata, metadata, metadata, Crumb, PageHeader() (+1 more)

### Community 30 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 31 - "Generator Script and Paths"
Cohesion: 0.15
Nodes (16): main(), Generate the labelled synthetic invoice set (plan.md Phase 1). python…, Generate the synthetic set and print its label distribution., Repository paths. Assumes an editable install (`make setup`) so the repo layout…, distribution_table(), generate(), load_bands(), load_fx() (+8 more)

### Community 32 - "Residential Consignee R7"
Cohesion: 0.20
Nodes (16): fx_units_per_usd(), Currency -> units per 1 USD, from data/reference/fx.csv (approximate, see…, check(), invoice_total_usd(), R7 RESIDENTIAL_CONSIGNEE: a large shipment going to a private residence., The stated total in USD: via the FX table, else from the enriched lines' USD…, Flag a consignee (or, failing that, buyer) at a residential address on a large…, run() (+8 more)

### Community 33 - "Web Runtime Deps"
Cohesion: 0.11
Nodes (18): dependencies, class-variance-authority, clsx, @fontsource/instrument-serif, geist, lucide-react, next, @radix-ui/react-dialog (+10 more)

### Community 34 - "Web Data Types"
Cohesion: 0.14
Nodes (16): ADDR, Draft, drafts, scoreFlags(), AddressType, Analyst, AnalystNote, AssessmentItem (+8 more)

### Community 35 - "Synthetic CSV Outputs"
Cohesion: 0.18
Nodes (17): _csv(), Generated, invoices_csv(), labels_csv(), lines_csv(), One synthetic invoice with its ground truth: the Invoice, template, role,…, Render rows as CSV text with Unix newlines (byte-stable output)., labels.csv: one row per planted anomaly and per hard negative. (+9 more)

### Community 36 - "Sign-in and Previews"
Cohesion: 0.16
Nodes (12): metadata, SignInPage(), SignInForm(), PriorityBadge(), OverviewPreview(), web_src_data_index_attentionqueue, web_src_data_index_casecounts, web_src_data_index_flagsbyrule (+4 more)

### Community 37 - "Analyst Notes and Queue"
Cohesion: 0.32
Nodes (11): ProfileMenu(), CaseFacts(), NotesTab(), AttentionQueue(), AnalystAvatar(), analystById(), analysts, daysFromDemoNow() (+3 more)

### Community 38 - "Enrich and Keyword Proposer"
Cohesion: 0.17
Nodes (13): enrich(), P2: line item -> HS6 + normalised quantity and USD price per benchmark unit., Classify and normalise every line: one EnrichedLine per invoice line, same…, default_proposer(), KeywordProposer, LLM (cached) when ANTHROPIC_API_KEY and LLM_MODEL are set, else the offline…, Offline baseline: score = 1 - 0.4**keyword_hits, so one hit 0.6, two 0.84., _invoices() (+5 more)

### Community 39 - "LLM Structuring"
Cohesion: 0.17
Nodes (14): _json_object(), Exception, Plan 2.2 / 2.5: LLM structuring with schema validation, one retry, and a file-…, The LLM did not produce a valid Invoice after the retry., Extract the JSON object from a reply, tolerating code fences and surrounding…, Validate a model payload as an Invoice, forcing `source_file` and…, A validated payload and the number of LLM calls (1 or 2) it took., Ask the LLM for an Invoice; on a parse/validation failure retry once with the… (+6 more)

### Community 40 - "Proposer Protocol"
Cohesion: 0.19
Nodes (9): _parse(), Proposer, Protocol, Candidate proposers: something that turns a description into scored HS6…, Pull the JSON object out of a model reply and validate it; ValueError on…, Anything that can turn a description into scored HS6 guesses (best first, at…, HS6Candidate, A proposed 6-digit HS commodity code with the proposer's 0-1 score. (+1 more)

### Community 41 - "PDF Rendering"
Cohesion: 0.15
Nodes (13): fmt_money(), fmt_price(), fmt_qty(), Path, Render an `Invoice` to PDF through one of the Jinja2 HTML templates and…, Whole numbers without decimals, otherwise one decimal., Unit price with more digits for small values; must match the generator's…, Amount with thousands separators and two decimals. (+5 more)

### Community 42 - "Root Layout and Fonts"
Cohesion: 0.15
Nodes (10): @fontsource/instrument-serif, geist, @radix-ui/react-tooltip, sonner, web_src_app_globals, metadata, viewport, notify() (+2 more)

### Community 43 - "Site Layout and Header"
Cohesion: 0.27
Nodes (5): Logo(), SiteFooter(), links, SiteHeader(), brand

### Community 44 - "Geo Rule Tests"
Cohesion: 0.32
Nodes (11): party(), parametrize, run(), test_city_in_wrong_country_is_high(), test_consistent_origin_not_flagged(), test_dubai_loading_port_with_uae_origin(), test_explained_reexport_or_transhipment_not_flagged(), test_falls_back_to_seller_country_without_a_port() (+3 more)

### Community 45 - "FastAPI App"
Cohesion: 0.20
Nodes (10): check(), health(), FastAPI app. Phase 0: health + a stub /check so the frontend can develop…, root(), fastapi, fastapi_middleware_cors, get, post (+2 more)

### Community 46 - "Web Dev Deps"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, @playwright/test, tailwindcss, @tailwindcss/postcss, @types/node (+3 more)

### Community 47 - "LLM Reply Cache"
Cohesion: 0.29
Nodes (10): cache_dir(), cache_path(), Any, Path, Cache root: $TBML_CACHE_DIR, else data/cache., File for one document's cached reply; the prompt version in the name…, The cached invoice payload, or None on a miss or a corrupt entry., Store a validated payload with the model and prompt version that produced it. (+2 more)

### Community 48 - "Fictional Party Factory"
Cohesion: 0.24
Nodes (6): _Factory, Builds fictional parties, addresses and lines, drawing every choice from one…, Invented company name with a legal suffix valid for the country., Country-style business address and its true type (UAE P.O. boxes are `unknown`)., Country-style private-home address (flat, apartment, byt, room)., A seller or buyer in country `cc` with a business address.

### Community 49 - "Country Lookup"
Cohesion: 0.33
Nodes (8): country_code(), country_from_address(), _key(), Country name -> ISO-3166 alpha-2, for the countries seen on invoices (extend as…, Lookup key: lower-cased, dots removed, whitespace collapsed, edge commas…, ISO code for a country name, or None. Accepts 'Made in China', 'China (re-…, Country of an address: the last comma-separated segment, else any country name…, test_countries()

### Community 50 - "Anthropic Client"
Cohesion: 0.22
Nodes (7): AnthropicClient, configured_client(), _load_dotenv(), An Anthropic client when ANTHROPIC_API_KEY and LLM_MODEL are set (env or .env),…, LLMClient over the Anthropic Messages API (temperature 0 where the model allows…, Send one request and return the concatenated text blocks of the reply., Copy KEY=value lines from the repo-root .env into os.environ without overriding…

### Community 51 - "Cached Proposer"
Cohesion: 0.32
Nodes (5): CachedProposer, Path, Disk cache keyed by (model, prompt version, normalised description)., Cache file for a description; whitespace and case are normalised before hashing., Cached answer if present, else ask the inner proposer and store its answer.

### Community 52 - "Playwright Smoke Tests"
Cohesion: 0.25
Nodes (4): ref_node_fs, @playwright/test, errors, routes

### Community 53 - "HMRC Records and FX"
Cohesion: 0.33
Nodes (7): hmrc_records(), load_fx(), DataFrame, HMRC rows -> the same record shape, converting GBP value to USD. Only CN and AE…, Annual average FX table (data/reference/fx_annual.csv)., USD per one unit of `currency` in `year`, falling back to the nearest year in…, usd_per_unit()

### Community 54 - "Anthropic Proposer"
Cohesion: 0.33
Nodes (5): AnthropicProposer, Asks an Anthropic model for HS6 candidates as JSON; retries once with the parse…, _Client, test_anthropic_proposer_fails_after_two_bad_replies(), test_anthropic_proposer_parses_json_and_retries_once()

### Community 55 - "Proposer Errors"
Cohesion: 0.33
Nodes (6): ProposerError, Any, The proposer could not produce a usable answer., test_proposer_error_gives_null(), propose(), RuntimeError

### Community 56 - "Parsing Unit Tests"
Cohesion: 0.29
Nodes (7): parse_date(), Parse ISO, DD/MM/YYYY (day first), '3 Mar 2024' and 'March 3, 2024'; None if…, parametrize, test_address_type(), test_parse_date(), test_parse_number(), date

### Community 57 - "npm Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, start, test:e2e, typecheck

### Community 58 - "Case Page Route"
Cohesion: 0.43
Nodes (5): CasePage(), generateMetadata(), CaseView(), nextId(), investigationById()

### Community 59 - "ESLint Config"
Cohesion: 0.33
Nodes (5): @eslint/eslintrc, ref_path, ref_url, compat, __dirname

### Community 60 - "Band Computation"
Cohesion: 0.40
Nodes (5): _bands(), compute_bands(), The p10, p25, median, p75 and p90 of an array of unit values., rec columns: hs6, year, source, route, value_usd, qty. Returns rows matching…, ndarray

### Community 61 - "Extract Wrapper"
Cohesion: 0.40
Nodes (5): extract(), Path, Convenience wrapper returning only the Invoice from `extract_document`., Save the text sent to the LLM under cache/raw_text/<sha256>.txt (best effort)., _write_raw_text()

### Community 62 - "LLM Client Protocol"
Cohesion: 0.40
Nodes (4): LLMClient, Protocol, Minimal client surface so tests can pass a fake: a model name and one…, Send the conversation and return the reply text.

### Community 63 - "Rules Config Loader"
Cohesion: 0.50
Nodes (4): _config(), Any, Parse config.yaml once per process., One section of rules/config.yaml (see that file for what each key means).

## Knowledge Gaps
- **148 isolated node(s):** `tbml`, `__dirname`, `compat`, `nextConfig`, `name` (+143 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 498 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Invoice` connect `Pipeline and Benchmark` to `Extraction Result`, `Residential Consignee R7`, `Unit and FX Normalisation`, `Extraction Finalise and Address`, `Rule Shared Helpers`, `Synthetic CSV Outputs`, `Enrich and Keyword Proposer`, `LLM Structuring`, `Rule Test Builders`, `PDF Rendering`, `Extraction Tests`, `Priority Scoring`, `Synthetic Catalogue and Generator`, `Extraction Accuracy Scoring`, `Synthetic Dataset Tests`, `Placeholder and Classify Tests`, `Golden Fixtures`, `Extract Wrapper`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `Severity` connect `Severity and R1 Tests` to `Pipeline and Benchmark`, `Residential Consignee R7`, `Rule Shared Helpers`, `Rule Test Builders`, `Priority Scoring`, `Geo Rule Tests`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `next` connect `Workspace Route Pages` to `Marketing and Domain UI`, `Sign-in and Previews`, `Analyst Notes and Queue`, `App Shell and Nav`, `Overview Charts`, `Case View Tabs`, `Root Layout and Fonts`, `Site Layout and Header`, `Entity Graph Explorer`, `Entity Detail Panels`, `Forms and Request Demo`, `Investigation List Filters`, `Transactions and Funds Flow`, `Case Page Route`, `Web Tooling Deps`, `Status Badges`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `Invoice` (e.g. with `enrich()` and `extract()`) actually correct?**
  _`Invoice` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 32 inferred relationships involving `Severity` (e.g. with `_severity()` and `make_flag()`) actually correct?**
  _`Severity` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Rule` (e.g. with `check()` and `make_flag()`) actually correct?**
  _`Rule` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Benchmark` (e.g. with `benchmark()` and `check()`) actually correct?**
  _`Benchmark` has 20 INFERRED edges - model-reasoned connections that need verification._