# Benchmark data notes (Phase 3A, tasks 3.1-3.5, 3.12)

Own-section log; merge into DECISIONS.md when that file exists on main.

## Decisions
- **Mock fallback used.** The build sandbox's egress proxy returned 403 for api.uktradeinfo.com, comtradeapi.un.org and
  www.trade-tariff.service.gov.uk, and no `COMTRADE_API_KEY` is available. `fetch_benchmarks.py` therefore wrote
  `data/benchmarks/bands_mock.json` (`is_mock=True`, `sources=["MOCK approximate"]`). The UI must show the "mock benchmark" badge.
- **Mock rows are global only** (`route=null`). Per-route mock rows would be invented; consumers fall back to global (per §3.3).
- **`n_observations=1` and `years` in mock rows are nominal placeholders** (so the `n_observations > 0` test passes); they are not real counts.
- **Mock values** are order-of-magnitude public unit values (USD per unit). They are not measured data.
- **Fetch code is untested against live APIs.** The HMRC OTS OData query (`FlowTypeId in (1,3)` = imports, `Commodity/Hs6Code`,
  `$expand=Country`) and Comtrade v1 REST call follow the public docs; run `python backend/scripts/fetch_benchmarks.py`
  from a machine with network access (plus `COMTRADE_API_KEY` for Comtrade) to produce `bands.json`. Pipeline logic
  (unit values, 1% trim, percentiles, route fallback at n<10) is covered by `test_compute_bands_pipeline`.
- **Units:** kg for 731815/090111/740311, litres for 220210, units for 852351/610910/847130. Comtrade uses `netWgt` for kg goods, `qty` otherwise;
  HMRC uses `NetMass` / `SuppUnit`. Confirm 220210 reports litres on live data; if not, switch to kg.
- **FX** (`data/reference/fx.csv`): approximate annual averages for GBP/EUR/CNY/AED/CZK, written from memory, labelled approximate. Verify before production.

## HS6 verification (§5.1) — NOT yet done against an official source
`python backend/scripts/fetch_benchmarks.py --verify-hs` calls the UK Trade Tariff API and prints official descriptions; it could not run here (403).
Descriptions below are from the HS 2022 nomenclature as I recall it, so treat as unverified:

| HS6 | Description (HS 2022, unverified) |
|---|---|
| 731815 | Screws and bolts, whether or not with their nuts or washers: other |
| 220210 | Waters, incl. mineral and aerated, containing added sugar/sweetener or flavoured |
| 852351 | Solid-state non-volatile storage devices |
| 610910 | T-shirts, singlets and other vests, of cotton, knitted or crocheted |
| 090111 | Coffee, not roasted: not decaffeinated |
| 740311 | Refined copper cathodes and sections of cathodes |
| 847130 | Portable automatic data processing machines, <= 10 kg, with CPU, keyboard and display |

No code looks wrong. 852351 exists only from HS 2022, so older trade years may report it under 847170 / 8523.

## Band table (mock, USD per unit)
| HS6 | unit | p10 | p25 | median | p75 | p90 |
|---|---|---|---|---|---|---|
| 731815 | kg | 1.40 | 2.20 | 3.40 | 5.20 | 8.00 |
| 220210 | l | 0.30 | 0.45 | 0.70 | 1.10 | 1.80 |
| 852351 | u | 3.50 | 6.00 | 10.50 | 18.00 | 32.00 |
| 610910 | u | 1.40 | 2.20 | 3.30 | 4.80 | 7.00 |
| 090111 | kg | 2.60 | 3.60 | 4.80 | 6.20 | 8.00 |
| 740311 | kg | 7.40 | 8.30 | 9.00 | 9.60 | 10.30 |
| 847130 | u | 210 | 330 | 520 | 780 | 1150 |

Sanity: laptop median is hundreds of USD per unit; copper cathode is single-digit USD per kg; no band is 10x off its expected magnitude.
