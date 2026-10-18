# databases/

Sharded HMRC price benchmark databases: UK imports (HMRC Overseas Trade Statistics), July 2023 to August 2026, every commodity code. 98 SQLite files, one per HS chapter (`db_01.db` ... `db_97.db`; chapter 77 is reserved and has none). Chapters 84 and 85 are split on the code's third digit (`db_84a.db` for 840-842, `db_84b.db` for 843-849), so a CN8 code, its HS6 and its HS4 are always in the same file.

Each file has `benchmarks` (one row per code, level, basis, origin, unit, year; prices in GBP, p1 to p99), the `current_benchmarks` view (`recommended = 1`), `commodities` (CN8 to HS6/HS4, supplementary unit, description), and `skipped` / `build_info` (audit metadata).

The backend reads them through `backend/tbml/benchmark/shards.py` and `tbml.benchmark.benchmark()`; see DECISIONS D11.1-D11.3 and DV5. `TBML_DATABASES_DIR` points it elsewhere; `TBML_BENCHMARKS=bands` turns them off.
