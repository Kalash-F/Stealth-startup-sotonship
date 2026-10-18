# Raw trade data responses

`backend/scripts/fetch_benchmarks.py` caches every API response here as
`<source>_<hs6>_<year>_<tag>_<fetch date>.json`. Only the HMRC files are committed, gzipped.

## HMRC files (`hmrc_*.json.gz`)

Contains public sector information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
Source: HMRC Overseas Trade Statistics, [uktradeinfo.com](https://www.uktradeinfo.com/).

- **What:** UK imports (`FlowTypeId` 1 and 3) for the 7 benchmark commodities, 2023–2025, one file
  per commodity and year, from `https://api.uktradeinfo.com/OTS`. Each row is one partner country,
  UK port and month, with `Value` (GBP), `NetMass` (kg) and `SuppUnit`.
- **Fetched:** 2026-10-17. HMRC treats figures as provisional for up to 18 months, so a fresh fetch
  may differ.
- **Format:** gzip-compressed JSON:
  `{"fetched", "source", "hs6", "year", "tag", "data": [rows]}`. Read with
  `json.loads(gzip.open(path).read())`.

## Comtrade files (not committed)

UN Comtrade responses stay local. Its usage agreement prohibits redistribution or publication without
written permission from the United Nations ([comtrade@un.org](mailto:comtrade@un.org)).
