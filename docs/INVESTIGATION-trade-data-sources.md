# Investigation: UN Comtrade and HMRC data integration

Covers issue "Investigate UN Comtrade and HMRC data" (branch `13-investigate-un-comtrade-and-hmrc-data`).
It documents the two external trade data sources, explains why `backend/scripts/fetch_benchmarks.py`
had only ever produced mock output, reports a full live run of the fetch, and recommends next steps.
[`data/benchmarks/NOTES-benchmarks.md`](../data/benchmarks/NOTES-benchmarks.md) has the original
blocker log. All live checks were made on 2026-10-17.

The code fixes described here are a separate change, on branch `trade-data-fetch-fixes` (§9).

## 1. Summary

- Both sources work. HMRC needs no key; Comtrade needs a free subscription key (§2).
- The fetch had never run because no Comtrade key existed and the build sandbox's network proxy
  blocked all three hosts. A bug in the HMRC query would also have broken it on any machine (§4).
- With those fixed, a full run produces real bands for all 7 commodities from both sources. The
  benchmark stage would read them with no code changes.
- The real bands aren't committed yet. The synthetic eval invoices were priced against the mock
  bands, and under the real ones three legitimate invoices pick up price flags, which fails an eval
  test (§6).
- The bands are often too wide to catch mispricing, and two commodities are built on truncated
  Comtrade results (§6). Copper, laptops and coffee look usable.
- The data fits price-plausibility checks well and could also support route-plausibility and
  mirror-trade checks, which aren't built. It has no shipment- or invoice-level detail (§7).

## 2. UN Comtrade

- **Base URL:** `https://comtradeapi.un.org`.
- **Keyless preview:** `GET /public/v1/preview/{type}/{freq}/{classification}`, for example `C/A/HS`
  (goods, annual, HS codes). It returns at most 500 records and one period per call, so it's only
  good for testing.
- **Keyed data:** `GET /data/v1/get/{type}/{freq}/{classification}` with the header
  `Ocp-Apim-Subscription-Key`. This is the endpoint `fetch_comtrade()` uses. Without a key it
  returns a clear `401`.
- **Availability:** `GET /data/v1/getDa/{type}/{freq}/{classification}` lists the periods each
  reporting country has published and when each was released (used for §5).
- **Getting a key:** register on the UN Comtrade website and subscribe to the free "comtrade - v1"
  product under My API portal. Community docs put the free tier at about 500 calls a day; that
  figure is unconfirmed.
- **Main parameters:** `reporterCode` and `partnerCode` (numeric M49 country codes), `period` (a year,
  or year and month), `cmdCode` (commodity code), `flowCode` (`M` imports, `X` exports), `freqCode`
  (`A` annual, `M` monthly).
- **Fields the script reads:** `primaryValue` (USD), `netWgt` (kg), `qty` and `qtyUnitCode` (other
  units), `partnerCode`.
- **Limits seen in practice:**
  - Bursts of calls get `429 Too Many Requests`. The first full run lost 28 of about 105 calls this
    way. With 2-second spacing and retries (§9), the second run lost none.
  - Responses cap at **100,000 rows**. Six all-countries responses came back at exactly that size
    (§6).
  - `partnerCode` 0 means "World", a country's total across all partners. Those rows repeat the
    country-to-country rows, and made up about 10–14% of the two all-countries files checked.

## 3. HMRC UK Trade Info

- **Base URL:** `https://api.uktradeinfo.com`. Fully open: no key and no auth header.
- **Style:** REST with OData query options (`$filter`, `$select`, `$expand`, `$top`). JSON by default,
  CSV on request. Swagger docs at `/swagger/ui/index`.
- **Endpoints:** reference data (`/Commodity`, `/Country`, `/Date`, `/FlowType`, `/Port`, `/Region`,
  `/SITC`, `/TradeType`, `/Trader`) and trade data (`/OTS`, `/RTS`, `/Import`, `/Export`, `/Trade`).
  The script uses `/OTS`, the monthly Overseas Trade Statistics.
- **OTS fields:** `MonthId` (YYYYMM), `FlowTypeId` (the script filters 1 and 3 for imports), `Value`
  (GBP), `NetMass` (kg), `SuppUnit` (supplementary quantity, such as an item count),
  `Commodity.Hs6Code`, `Country.CountryCodeAlpha`, `PortId`.
- **Limits:** 60 requests a minute. Responses cap at 40,000 rows but page properly through
  `@odata.nextLink`, which the script follows.
- **Unsupported operations return a misleading `403`** ("Your request has been rejected... rate
  limit"), not a 400. Both the `in (...)` filter operator (§4) and `$orderby` fail this way.
- **Not covered:** HMRC also publishes bulk download files and an interactive table builder. Neither
  is needed while the API works.

**How it complements Comtrade:** it's UK-only, but monthly and at port level, with both weight and
supplementary units. It's more current than Comtrade (about 2 months behind, against 9+). It also
covers the UK side of routes where the partner country doesn't report to Comtrade, such as the UAE.

## 4. Why it never ran, and the HMRC bug

1. **No `COMTRADE_API_KEY`.** `.env.example` declared it, but no key had been obtained.
2. **The sandbox blocked egress.** Its proxy returned 403 for `api.uktradeinfo.com`,
   `comtradeapi.un.org` and `www.trade-tariff.service.gov.uk`.
3. **The HMRC query was broken.** `fetch_hmrc()` filtered with `FlowTypeId in (1,3)`, which this API
   rejects with a 403. The same query with `(FlowTypeId eq 1 or FlowTypeId eq 3)` returns data. The
   fixes PR makes this change.

The script hid all three problems. It catches every fetch error, prints it and carries on, and when
real data is incomplete it quietly writes the mock bands and exits 0. No test exercised the HTTP code.

Other problems found:
- The script reads `COMTRADE_API_KEY` from the process environment and doesn't load `.env` itself.
  Load it into the shell before running (`set -a && source .env && set +a`). Not changed.
- `verify_hs6()` builds a UK Trade Tariff URL that returns 404 against the live API, so the 7
  commodity codes have still never been checked against an official source. Not changed.

## 5. Historical depth and update frequency

**HMRC**

| Dataset | Coverage | Frequency and lag |
|---|---|---|
| OTS (used) | Jan 2000 – Aug 2026 | Monthly; about 2 months behind |
| RTS | Q1 2013 – Q2 2026 | Quarterly; about 3–4 months behind. SITC codes and UK regions only, so not useful for price bands |

HMRC treats published figures as provisional for up to 18 months, so recent months get revised.

**UN Comtrade** (from the availability endpoint)

| Reporting country | Annual data | Latest annual release | Monthly data |
|---|---|---|---|
| UK | 1993–2025 | Sep 2026 | Jan 2010 – Jul 2026 |
| China | 1992–2025 | Sep 2026 | Jan 2010 – Dec 2024 |
| Czechia | 1993–2025 | Apr 2026 | Jan 2010 – Jul 2026 |
| UAE | 1991–2023, 28 of 33 years | Jun 2025 | 2010–2019 only |

- Countries that report promptly publish a year's annual data about 9 months after it ends. The UAE
  has nothing after 2023.
- Fewer countries report than used to. A World Bank post counted 146 countries with 2022 annual data
  as of March 2024, against 177 for 2017. The newest year is always the patchiest.
- Each year is stored in the edition of the HS code system the country used (HS1992 to HS2022), and
  codes change between editions. For example, 852351 only exists from HS2022. Going back before about
  2022 would need a conversion table. The current 2023–2025 window avoids this.

## 6. Results of the full run

The run used `python backend/scripts/fetch_benchmarks.py` with the key loaded, HMRC OTS plus keyed
Comtrade, for 2023–2025. It made about 105 Comtrade calls with no failures, and took about 13
minutes. Global bands, in USD per benchmark unit:

| HS6 | Commodity | Unit | p10 | p25 | Median | p75 | p90 | n | Mock median |
|---|---|---|---|---|---|---|---|---|---|
| 740311 | Copper cathodes | kg | 8.31 | 8.80 | 9.51 | 10.53 | 28.90 | 8,329 | 9.00 |
| 847130 | Laptops | unit | 125.43 | 296.89 | 548.83 | 1,004.34 | 1,763.04 | 154,412 | 520 |
| 090111 | Green coffee | kg | 3.25 | 4.74 | 6.96 | 11.60 | 24.60 | 72,725 | 4.80 |
| 220210 | Flavoured water | l | 0.65 | 0.98 | 1.50 | 3.01 | 8.01 | 90,825 | 0.70 |
| 610910 | Cotton T-shirts | unit | 3.80 | 5.94 | 12.27 | 24.61 | 61.08 | 276,044 | 3.30 |
| 731815 | Screws and bolts | kg | 3.50 | 5.51 | 14.00 | 42.47 | 136.88 | 291,954 | 3.40 |
| 852351 | USB drives / SSDs | unit | 5.66 | 15.32 | 53.05 | 201.81 | 738.38 | 129,764 | 10.50 |

`n` counts source records after trimming: one Comtrade record is a reporter–partner–year total, and
one HMRC record is a partner–port–month total. Neither is a shipment.

**Route bands** need at least 10 records. The run produced:
- CN-GB and AE-GB for every commodity except copper.
- AE-CZ for T-shirts, screws, laptops and USB drives.
- No GB-AE bands at all. That route asks for imports reported by the UAE, which has no Comtrade data
  after 2023. The 2023 data should still have given some rows, and why it didn't hasn't been checked.

**Reading the results:**
- **Copper and laptops** match market expectations. Copper's band is tight (p10 to p75 is
  $8.31–10.53/kg).
- **Coffee** sits above the mock value, which fits the sharp rise in coffee prices in 2024–25.
- **Flavoured water** is about twice the mock value. That litres are the right unit is still
  unconfirmed.
- **T-shirts and screws** come from truncated data. All three years of their all-countries Comtrade
  calls stopped at exactly 100,000 rows, and it isn't known which rows were cut.
- **The bands are wide.** For several codes p10 to p90 spans 10 to 100 times. A price rule built on
  them will miss most under- and over-invoicing. Likely causes:
  - One HS6 code covers very different products. 852351 runs from cheap USB sticks to enterprise
    SSDs.
  - The percentiles count every record equally, whatever the quantity traded.
  - Mispriced trade is already in the reference data. UAE-to-UK screws have a p90 of $863/kg.

**Effect on the eval.** With the real bands, the full test suite fails only
`test_detection_eval_beats_random_at_20_percent`. Detection still beats random at a 20% review
budget, but 1 of the 6 hard negatives (legitimate invoices built to look suspicious) reaches review
priority, where the test expects none. Three hard negatives pick up price flags:

| Invoice | Kind | Route | Flag |
|---|---|---|---|
| PI-0005-24 | Bulk discount near p10 | CN-GB | T-shirts at $2.20 and $2.70 per item read as under-invoiced; reaches review |
| TX240022 | Unusual route, explained | AE-CZ | Screws at $2.71/kg read as under-invoiced |
| TX240058 | Premium near p90 | CN-GB | T-shirts at $2.63 per item read as under-invoiced |

These invoices were priced against the mock bands. For example, the China-to-UK T-shirt band now
starts at $3.45, where the mock band started at $1.40. The flags come from route bands, which the
100,000-row cap doesn't affect, so the real bands may well be right and the test data is what's out
of step. For that reason the real bands aren't committed yet (§10).

## 7. Usefulness for TBML detection

| Use | Data | Status |
|---|---|---|
| Price plausibility: invoice unit price against historical unit values | Both | Built; real bands produced but not yet committed (§6) |
| Route plausibility: does this pair of countries trade this good in volume? | Comtrade country-to-country totals | Not built; uses data already fetched |
| Mirror-trade gaps: exporter's reported value against importer's | Comtrade has both sides; HMRC has the UK side | Not built; normal reporting differences make it a weak signal on its own |
| Commodity code validation | HMRC `/Commodity` (official codes and descriptions) | Mostly covered on `main`: `data/reference/hs.db` now holds a full HS code list for the classifier. HMRC's list could be used to check it against an official source |
| UK counterparty check | HMRC `/Trader` (company name, address, postcode) | Untested; unknown whether traders link to commodity codes |

**Limitations:**
- No invoice- or shipment-level prices; every record is an aggregate.
- No company data in Comtrade.
- HS6 codes are often too broad for tight price bands.
- Routes go thin or empty when a country doesn't report (the UAE).
- The newest year is incomplete.
- Recent HMRC months get revised.

## 8. Integration architecture

The pipeline is: invoice → `extract` → `classify` (line to HS6 code and benchmark unit) →
`benchmark` (look up the HS6 band, by route if available) → `rules` → `score`. Trade data only enters
at `benchmark`, as rows of the `Benchmark` schema (`hs6, route, unit, p10, p25, median, p75, p90,
n_observations, years, sources, is_mock`). `tbml/benchmark` already prefers `bands.json` over
`bands_mock.json` and falls back from a route band to the global one, so nothing downstream needs
to change. (`main` switched the band table from parquet to JSON so the deployed API doesn't need
pandas.)

- **Fetch:** an offline script, never called at runtime. Comtrade calls are spaced 2 seconds apart
  and retried on 429 (§9). HMRC pages through `@odata.nextLink`.
- **Transform:** value ÷ quantity, using weight for kg goods and the supplementary or quantity field
  otherwise. HMRC values are converted from GBP with `data/reference/fx_annual.csv`.
- **Validate (current):**
  - Drop rows with no value or quantity, and Comtrade World rows.
  - Trim the top and bottom 1% per commodity.
  - Only keep a route band with at least 10 records.
  - Fall back to the mock bands if any commodity is missing.
- **Validate (proposed):**
  - Fail loudly when a Comtrade response hits the 100,000-row cap.
  - Report call failures and missing commodity-year pairs, not just print them.
  - Check `qtyUnitCode` is consistent per commodity.
- **Store:** `bands.json` (a few KB) is meant to be committed. Raw responses are cached under
  `data/benchmarks/raw/`, which the fixes PR gitignores because a full run is 1.1 GB. That means the
  raw inputs aren't kept with the repo. Rebuilding exact bands needs the local cache or a fresh
  fetch, and a fresh fetch will differ as sources revise their data.

## 9. Changes in the fixes PR

Branch `trade-data-fetch-fixes`, built on current `main`:

- `fetch_hmrc()`: `in (1,3)` replaced with an explicit `or`.
- `fetch_comtrade()`: at least 2 seconds between calls; on 429, up to 5 attempts, waiting for
  `Retry-After` or backing off exponentially.
- `comtrade_records()`: drops `partnerCode` 0 (World) rows.
- `backend/tests/test_benchmark.py`: tests for dropping World rows, retrying on 429, and giving up
  after the last attempt.
- `.gitignore`: ignores `data/benchmarks/raw/*` except `.gitkeep`.

It doesn't include `bands.json`, for the reason in §6, so the app keeps using the mock bands. The
full backend suite passes on that branch (341 tests).

## 10. Next steps

1. **Fix the 100,000-row cap.** First try `maxRecords=250000` on the 6 capped calls; the official
   Python client documents a 250,000-record limit for keyed calls, unconfirmed here. If they still
   cap, split by reporting country. Then re-run.
2. **Use UK exports for UAE routes.** Build GB-AE from HMRC or UK-reported Comtrade exports to the
   UAE, since the UAE doesn't report.
3. **Tighten the bands.** Test percentiles weighted by quantity, and decide how to handle broad codes
   such as 852351 (route bands only, or flag the band as weak).
4. **Recalibrate the synthetic invoices and commit the real bands.** The generator can already load
   a `bands*.json` (`load_bands` in `tbml/synthetic/generator.py`), but it prices against global bands
   only, while the price rule prefers route bands. Regenerating alone may not clear every flag; for
   example, the AE-CZ screws band starts above the global one. The generator may need to price
   against route bands. Then commit `bands.json` and update
   `test_health_reports_real_pipeline_and_mock_bands`, which expects mock bands. This changes the
   committed eval dataset, so it needs its own review.
5. **Fix or drop `verify_hs6()`.** Check the 7 commodity codes against `hs.db` or HMRC
   `/Commodity` instead.
6. **Load `.env` in the script**, or document the shell step, so a run can't silently skip Comtrade.
7. **Add the proposed validation** (§8) so cap hits and failed calls fail the run.
8. **Schedule refreshes:** HMRC monthly or quarterly to pick up new months and revisions; Comtrade
   yearly in the autumn, once the previous year has mostly arrived.
9. **Later:** route-plausibility checks, mirror-trade comparison, and a look at HMRC `/Trader`.

## Sources

- [HMRC: Get help with using our data](https://www.uktradeinfo.com/trade-data/help-with-using-our-data/)
- [HMRC: API documentation](https://www.uktradeinfo.com/api-documentation/)
- [UN Comtrade Python client (`comtradeapicall`)](https://github.com/uncomtrade/comtradeapicall)
- [World Bank Data Blog: the essential role of UN Comtrade](https://blogs.worldbank.org/en/opendata/the--essential--role-of-un-s-comtrade-in-trade-data)
