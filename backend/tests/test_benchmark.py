"""Task 3.12: band sanity. Reads bands.json, or bands_mock.json when real data is absent."""

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

from tbml.benchmark import band_table
from tbml.schemas import Benchmark

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))
import fetch_benchmarks as fb  # noqa: E402

BENCH = ROOT / "data" / "benchmarks"
HS6 = ["731815", "220210", "852351", "610910", "090111", "740311", "847130"]


@pytest.fixture(scope="module")
def bands() -> pd.DataFrame:
    return pd.DataFrame([b.model_dump() for b in band_table()])


def test_every_hs6_has_global_band(bands):
    glob = bands[bands.route.isna()]
    assert set(HS6) <= set(glob.hs6)


def test_bands_monotonic(bands):
    assert (bands.p10 <= bands.p25).all() and (bands.p25 <= bands["median"]).all()
    assert (bands["median"] <= bands.p75).all() and (bands.p75 <= bands.p90).all()
    assert (bands.p10 > 0).all()


def test_n_observations_positive(bands):
    assert (bands.n_observations > 0).all()


def test_mock_flag_consistent(bands):
    assert bands.is_mock.dtype == bool
    assert (bands.sources.map(lambda s: "MOCK approximate" in list(s)) == bands.is_mock).all()


def test_route_rows_only_with_enough_observations(bands):
    routed = bands[bands.route.notna()]
    assert (routed.n_observations >= fb.MIN_ROUTE_OBS).all()


def test_mock_magnitudes():
    m = fb.mock_bands().set_index("hs6")
    assert 100 < m.loc["847130", "median"] < 2000  # laptop: hundreds of USD per unit
    assert 5 < m.loc["740311", "median"] < 12  # copper cathode: single-digit USD per kg


def test_compute_bands_pipeline():
    """Synthetic raw records: outliers trimmed, thin route (n<10) falls back to global."""

    def rec(i, route):
        return dict(
            hs6="731815", year=2023, source="HMRC OTS", route=route, value_usd=float(i + 1), qty=1.0
        )

    rows = [rec(i, "CN-GB") for i in range(50)] + [rec(i, "GB-AE") for i in range(5)]
    rows.append(rec(1e6, None))  # outlier
    out = fb.compute_bands(pd.DataFrame(rows))
    glob = out[out.route.isna()].iloc[0]
    assert glob.p90 < 1000
    assert list(out.route.dropna()) == ["CN-GB"]


def test_written_bands_load_as_benchmarks(tmp_path):
    """The script's JSON output is what tbml.benchmark reads: route rows and nulls survive."""
    rows = [
        dict(hs6="731815", year=2023, source="HMRC OTS", route="CN-GB", value_usd=i + 1.0, qty=1.0)
        for i in range(20)
    ]
    out = fb.compute_bands(pd.DataFrame(rows))
    fb.write_bands(out, tmp_path / "bands.json")
    loaded = [
        Benchmark.model_validate(r) for r in json.loads((tmp_path / "bands.json").read_text())
    ]
    assert [b.route for b in loaded] == [None, "CN-GB"]
    assert loaded[0].years == [2023] and loaded[0].sources == ["HMRC OTS"]


def test_comtrade_records_drop_world_totals():
    raw = [
        dict(partnerCode=0, netWgt=100.0, primaryValue=500.0),
        dict(partnerCode=156, netWgt=60.0, primaryValue=300.0),
    ]
    recs = fb.comtrade_records(raw, "090111", 2024, None)
    assert [r["value_usd"] for r in recs] == [300.0]


class _Resp:
    def __init__(self, status, headers=None):
        self.status_code, self.headers = status, headers or {}

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)

    def json(self):
        return {"data": [{"ok": True}]}


def test_fetch_comtrade_retries_on_429(monkeypatch):
    replies = [_Resp(429, {"Retry-After": "3"}), _Resp(429), _Resp(200)]
    sleeps = []
    monkeypatch.setattr(fb.requests, "get", lambda *a, **k: replies.pop(0))
    monkeypatch.setattr(fb.time, "sleep", sleeps.append)
    monkeypatch.setattr(fb, "COMTRADE_MIN_INTERVAL", 0.0)
    assert fb.fetch_comtrade("090111", 2024, "key") == [{"ok": True}]
    assert sleeps == [3.0, 4.0]


def test_fetch_comtrade_gives_up_after_retries(monkeypatch):
    monkeypatch.setattr(fb.requests, "get", lambda *a, **k: _Resp(429))
    monkeypatch.setattr(fb.time, "sleep", lambda s: None)
    monkeypatch.setattr(fb, "COMTRADE_MIN_INTERVAL", 0.0)
    with pytest.raises(RuntimeError):
        fb.fetch_comtrade("090111", 2024, "key")
