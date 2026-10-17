"""Fetch trade data, compute unit-value price bands, write data/benchmarks/bands*.json.

Plan tasks 3.1-3.5. Run:  python backend/scripts/fetch_benchmarks.py [--mock] [--verify-hs]

Sources: UN Comtrade (needs COMTRADE_API_KEY in .env / env) and HMRC UK Trade Info OTS (no key).
If neither source yields data the script falls back to documented approximate values and writes
data/benchmarks/bands_mock.json with is_mock=True (task 3.5). Raw responses are cached under
data/benchmarks/raw/ so the runtime never calls an API.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
BENCH = ROOT / "data" / "benchmarks"
RAW = BENCH / "raw"
FX_CSV = ROOT / "data" / "reference" / "fx_annual.csv"

# HS6 -> (benchmark unit, official-ish description). Units follow the Comtrade quantity unit.
COMMODITIES = {
    "731815": (
        "kg",
        "Other screws and bolts, whether or not with their nuts or washers, of iron or steel",
    ),
    "220210": ("l", "Waters, incl. mineral and aerated, with added sugar/sweetener or flavoured"),
    "852351": ("u", "Solid-state non-volatile storage devices"),
    "610910": ("u", "T-shirts, singlets and other vests, of cotton, knitted or crocheted"),
    "090111": ("kg", "Coffee, not roasted, not decaffeinated"),
    "740311": ("kg", "Refined copper cathodes and sections of cathodes"),
    "847130": ("u", "Portable automatic data processing machines <= 10 kg (laptops)"),
}
ROUTES = ["CN-GB", "AE-GB", "GB-AE", "AE-CZ"]
YEARS_BACK = 3
MIN_ROUTE_OBS = 10
TRIM = 0.01
COLS = [
    "hs6",
    "route",
    "unit",
    "p10",
    "p25",
    "median",
    "p75",
    "p90",
    "n_observations",
    "years",
    "sources",
    "is_mock",
]

# Comtrade numeric reporter/partner codes and ISO3 for the routes (ISO3 -> route end).
M49 = {"CN": 156, "GB": 826, "AE": 784, "CZ": 203}
WORLD = 0  # Comtrade partnerCode for a reporter's all-partner total

# The free Comtrade tier answers bursts with 429, so space calls out and retry.
COMTRADE_MIN_INTERVAL = 2.0
COMTRADE_RETRIES = 5
_last_comtrade_call = 0.0

# Approximate values used ONLY when APIs are unreachable. USD per benchmark unit.
# Basis: order-of-magnitude public unit values 2022-24 (UK/EU import statistics, LME copper, ICO coffee).
MOCK = {  # hs6: (p10, p25, median, p75, p90)
    "731815": (1.4, 2.2, 3.4, 5.2, 8.0),  # kg  - fasteners vary widely by grade
    "220210": (0.30, 0.45, 0.70, 1.10, 1.80),  # l   - flavoured/energy drinks
    "852351": (3.5, 6.0, 10.5, 18.0, 32.0),  # u   - USB flash/SSD sticks by capacity
    "610910": (1.4, 2.2, 3.3, 4.8, 7.0),  # u   - cotton knitted tees
    "090111": (2.6, 3.6, 4.8, 6.2, 8.0),  # kg  - green coffee
    "740311": (7.4, 8.3, 9.0, 9.6, 10.3),  # kg  - LME copper ~ $8-10/kg
    "847130": (210, 330, 520, 780, 1150),  # u   - laptops
}


def load_fx() -> pd.DataFrame:
    """Annual average FX table (data/reference/fx_annual.csv)."""
    return pd.read_csv(FX_CSV)


def usd_per_unit(fx: pd.DataFrame, currency: str, year: int) -> float:
    """USD per one unit of `currency` in `year`, falling back to the nearest year in the table."""
    sub = fx[fx.currency == currency]
    if sub.empty:
        raise KeyError(f"no fx for {currency}")
    row = sub[sub.year == year]
    if row.empty:  # nearest year
        row = sub.iloc[[(sub.year - year).abs().argmin()]]
    return float(row.usd_per_unit.iloc[0])


# ---------------------------------------------------------------- fetching (3.1)
def _retry_after(r: requests.Response, attempt: int) -> float:
    """Seconds to wait after a 429: the Retry-After header if numeric, else exponential backoff."""
    try:
        return float(r.headers["Retry-After"])
    except (KeyError, ValueError):
        return float(2 ** (attempt + 1))


def fetch_comtrade(
    hs6: str, year: int, key: str, reporter: str | None = None, partner: str | None = None
) -> list[dict]:
    """Imports (flow M) for one HS6/year. reporter/partner are ISO2 codes or None for all."""
    global _last_comtrade_call
    params = {"cmdCode": hs6, "flowCode": "M", "period": str(year), "includeDesc": "false"}
    if reporter:
        params["reporterCode"] = str(M49[reporter])
    if partner:
        params["partnerCode"] = str(M49[partner])
    for attempt in range(COMTRADE_RETRIES):
        wait = _last_comtrade_call + COMTRADE_MIN_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        r = requests.get(
            "https://comtradeapi.un.org/data/v1/get/C/A/HS",
            params=params,
            headers={"Ocp-Apim-Subscription-Key": key},
            timeout=60,
        )
        _last_comtrade_call = time.monotonic()
        if r.status_code != 429 or attempt == COMTRADE_RETRIES - 1:
            break
        time.sleep(_retry_after(r, attempt))
    r.raise_for_status()
    return r.json().get("data", [])


def fetch_hmrc(hs6: str, year: int) -> list[dict]:
    """HMRC OTS records (value GBP, NetMass kg, SuppUnit) for one HS6/year, imports only."""
    base = "https://api.uktradeinfo.com/OTS"
    flt = (
        f"Commodity/Hs6Code eq '{hs6}' and (FlowTypeId eq 1 or FlowTypeId eq 3) "
        f"and MonthId ge {year}01 and MonthId le {year}12"
    )
    url = f"{base}?$filter={flt}&$expand=Country($select=CountryCodeAlpha),Commodity($select=Hs6Code)&$top=10000"
    out: list[dict] = []
    while url:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        js = r.json()
        out.extend(js.get("value", []))
        url = js.get("@odata.nextLink")
    return out


def cache_raw(source: str, hs6: str, year: int, tag: str, data: list[dict]) -> None:
    """Save a raw API response under data/benchmarks/raw/ so the runtime never needs the network."""
    RAW.mkdir(parents=True, exist_ok=True)
    payload = {
        "fetched": dt.date.today().isoformat(),
        "source": source,
        "hs6": hs6,
        "year": year,
        "tag": tag,
        "data": data,
    }
    (RAW / f"{source}_{hs6}_{year}_{tag}_{payload['fetched']}.json").write_text(json.dumps(payload))


# ------------------------------------------------------- unit values (3.2)
def comtrade_records(raw: list[dict], hs6: str, year: int, route: str | None) -> list[dict]:
    """Comtrade rows -> {hs6, year, source, route, value_usd, qty}, dropping World-total rows
    (they repeat the bilateral rows) and rows with no usable quantity (net weight for kg
    commodities, `qty` otherwise) or value."""
    unit = COMMODITIES[hs6][0]
    recs = []
    for d in raw:
        if d.get("partnerCode") == WORLD:
            continue
        qty = d.get("netWgt") if unit == "kg" else d.get("qty")
        val = d.get("primaryValue")
        if not qty or not val or qty <= 0 or val <= 0:
            continue
        recs.append(
            {
                "hs6": hs6,
                "year": year,
                "source": "UN Comtrade",
                "route": route,
                "value_usd": float(val),
                "qty": float(qty),
            }
        )
    return recs


def hmrc_records(raw: list[dict], hs6: str, year: int, fx: pd.DataFrame) -> list[dict]:
    """HMRC rows -> the same record shape, converting GBP value to USD. Only CN and AE partners
    get a route (`CN-GB`, `AE-GB`); other partners count towards the global band."""
    unit = COMMODITIES[hs6][0]
    gbp = usd_per_unit(fx, "GBP", year)
    recs = []
    for d in raw:
        qty = d.get("NetMass") if unit == "kg" else d.get("SuppUnit")
        val = d.get("Value")
        if not qty or not val or qty <= 0 or val <= 0:
            continue
        partner = (d.get("Country") or {}).get("CountryCodeAlpha")
        route = f"{partner}-GB" if partner in ("CN", "AE") else None
        recs.append(
            {
                "hs6": hs6,
                "year": year,
                "source": "HMRC OTS",
                "route": route,
                "value_usd": float(val) * gbp,
                "qty": float(qty),
            }
        )
    return recs


# ------------------------------------------------------------- bands (3.3)
def _bands(vals: np.ndarray) -> tuple[float, ...]:
    """The p10, p25, median, p75 and p90 of an array of unit values."""
    return tuple(float(x) for x in np.percentile(vals, [10, 25, 50, 75, 90]))


def compute_bands(rec: pd.DataFrame) -> pd.DataFrame:
    """rec columns: hs6, year, source, route, value_usd, qty. Returns rows matching Benchmark."""
    rows, notes = [], []
    rec = rec.assign(unit_value=rec.value_usd / rec.qty)
    for hs6, g in rec.groupby("hs6"):
        lo, hi = g.unit_value.quantile(TRIM), g.unit_value.quantile(1 - TRIM)
        g = g[(g.unit_value >= lo) & (g.unit_value <= hi)]
        scopes = [(None, g)] + [(r, g[g.route == r]) for r in ROUTES]
        for route, s in scopes:
            if route is not None and len(s) < MIN_ROUTE_OBS:
                notes.append(f"{hs6} {route}: n={len(s)} < {MIN_ROUTE_OBS}, falls back to global")
                continue
            if s.empty:
                continue
            p10, p25, med, p75, p90 = _bands(s.unit_value.to_numpy())
            rows.append(
                dict(
                    hs6=hs6,
                    route=route,
                    unit=COMMODITIES[hs6][0],
                    p10=p10,
                    p25=p25,
                    median=med,
                    p75=p75,
                    p90=p90,
                    n_observations=int(len(s)),
                    years=sorted(int(y) for y in s.year.unique()),
                    sources=sorted(s.source.unique().tolist()),
                    is_mock=False,
                )
            )
    for n in notes:
        print("note:", n)
    return pd.DataFrame(rows, columns=COLS)


def mock_bands() -> pd.DataFrame:
    """Approximate documented bands for every commodity, all flagged `is_mock=True`."""
    this = dt.date.today().year
    rows = [
        dict(
            hs6=h,
            route=None,
            unit=COMMODITIES[h][0],
            p10=v[0],
            p25=v[1],
            median=v[2],
            p75=v[3],
            p90=v[4],
            n_observations=1,
            years=[this - 3, this - 2, this - 1],
            sources=["MOCK approximate"],
            is_mock=True,
        )
        for h, v in MOCK.items()
    ]
    return pd.DataFrame(rows, columns=COLS)


def write_bands(bands: pd.DataFrame, path: Path) -> None:
    """Write the table as a JSON list of `Benchmark` rows, one per line: the format
    `tbml.benchmark` reads without pandas, so the deployed API stays small."""
    rows = json.loads(bands.to_json(orient="records"))
    path.write_text("[\n" + ",\n".join(f"  {json.dumps(r)}" for r in rows) + "\n]\n")


# ------------------------------------------------------------ HS verify
def verify_hs6() -> None:
    """Check each code against the UK Trade Tariff API and print official descriptions."""
    for hs6 in COMMODITIES:
        r = requests.get(
            f"https://www.trade-tariff.service.gov.uk/api/v2/subheadings/{hs6}00-80", timeout=30
        )
        d = r.json()["data"]["attributes"] if r.ok else {}
        print(hs6, r.status_code, d.get("description") or d.get("formatted_description"))


def main() -> int:
    """Fetch (or skip with --mock), compute and write the bands; falls back to the mock table
    unless real data covers every commodity."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--mock", action="store_true", help="skip APIs, write bands_mock.json")
    ap.add_argument("--verify-hs", action="store_true")
    a = ap.parse_args()
    BENCH.mkdir(parents=True, exist_ok=True)
    if a.verify_hs:
        verify_hs6()
        return 0
    recs: list[dict] = []
    if not a.mock:
        fx = load_fx()
        key = os.environ.get("COMTRADE_API_KEY")
        years = list(range(dt.date.today().year - YEARS_BACK, dt.date.today().year))
        for hs6 in COMMODITIES:
            for y in years:
                try:
                    h = fetch_hmrc(hs6, y)
                    cache_raw("hmrc", hs6, y, "ots", h)
                    recs += hmrc_records(h, hs6, y, fx)
                except Exception as e:  # noqa: BLE001
                    print(f"HMRC {hs6} {y} failed: {e}", file=sys.stderr)
                if key:
                    for tag, rep, par in [("all", None, None)] + [
                        (r, r.split("-")[1], r.split("-")[0]) for r in ROUTES
                    ]:
                        try:
                            c = fetch_comtrade(hs6, y, key, rep, par)
                            cache_raw("comtrade", hs6, y, tag, c)
                            recs += comtrade_records(c, hs6, y, None if tag == "all" else tag)
                        except Exception as e:  # noqa: BLE001
                            print(f"Comtrade {hs6} {y} {tag} failed: {e}", file=sys.stderr)
    df = pd.DataFrame(recs)
    if not df.empty:
        bands = compute_bands(df)
        if set(COMMODITIES) <= set(bands.hs6):
            write_bands(bands, BENCH / "bands.json")
            print(bands.to_string())
            return 0
        print("real data incomplete for some HS6; falling back to mock", file=sys.stderr)
    bands = mock_bands()
    write_bands(bands, BENCH / "bands_mock.json")
    print("WARNING: APIs unreachable/incomplete -> wrote bands_mock.json (is_mock=True)")
    print(bands.to_string())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
