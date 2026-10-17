"""Task 3.12: band sanity. Reads bands.parquet, or bands_mock.parquet when real data is absent."""
import sys
from pathlib import Path

import pandas as pd
import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))
import fetch_benchmarks as fb  # noqa: E402

BENCH = ROOT / "data" / "benchmarks"
HS6 = ["731815", "220210", "852351", "610910", "090111", "740311", "847130"]


@pytest.fixture(scope="module")
def bands() -> pd.DataFrame:
    p = BENCH / "bands.parquet"
    if not p.exists():
        p = BENCH / "bands_mock.parquet"
    return pd.read_parquet(p)


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
    assert 100 < m.loc["847130", "median"] < 2000   # laptop: hundreds of USD per unit
    assert 5 < m.loc["740311", "median"] < 12       # copper cathode: single-digit USD per kg


def test_compute_bands_pipeline():
    """Synthetic raw records: outliers trimmed, thin route (n<10) falls back to global."""
    def rec(i, route):
        return dict(hs6="731815", year=2023, source="HMRC OTS", route=route, value_usd=float(i + 1), qty=1.0)
    rows = [rec(i, "CN-GB") for i in range(50)] + [rec(i, "GB-AE") for i in range(5)]
    rows.append(rec(1e6, None))  # outlier
    out = fb.compute_bands(pd.DataFrame(rows))
    glob = out[out.route.isna()].iloc[0]
    assert glob.p90 < 1000
    assert list(out.route.dropna()) == ["CN-GB"]
