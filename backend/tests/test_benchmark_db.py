"""The sharded HMRC benchmark databases (data/databases) and the lookup on top of them."""

import random
import sqlite3
import sys
from contextlib import closing
from pathlib import Path

import pytest

from tbml import benchmark as bm
from tbml.benchmark import shards
from tbml.classify.nomenclature import default_nomenclature
from tbml.classify.normalise import normalise
from tbml.fixtures import load_fixture
from tbml.paths import DATABASES_DIR
from tbml.rules import price_outlier
from tbml.schemas import EnrichedLine, Invoice, LineItem

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "scripts"))
import pack_databases  # noqa: E402

pytestmark = pytest.mark.skipif(not shards.available(), reason="benchmark databases not present")


def _raw(code: str, level: str, **where) -> dict:
    """One row straight from the shard, for checking the lookup's conversions."""
    sql = "SELECT * FROM benchmarks WHERE code = ? AND level = ?" + "".join(
        f" AND {k} = ?" for k in where
    )
    with closing(sqlite3.connect(DATABASES_DIR / shards.shard_name(code))) as conn:
        conn.row_factory = sqlite3.Row
        return dict(conn.execute(sql, (code, level, *where.values())).fetchone())


def line(**fields) -> LineItem:
    base = dict(
        line_id="L1",
        description="goods",
        quantity=100.0,
        unit="pcs",
        unit_price=1.0,
        line_total=100.0,
        extraction_confidence=0.9,
    )
    return LineItem(**{**base, **fields})


def enriched(hs6: str, unit: str | None) -> EnrichedLine:
    return EnrichedLine(
        line_id="L1",
        hs6=hs6,
        hs6_description=None,
        hs6_candidates=[],
        classification_confidence=0.9,
        normalised_quantity=1.0,
        benchmark_unit=unit,
        unit_price_usd=1.0,
        normalisation_note="",
    )


@pytest.mark.parametrize(
    ("code", "name"),
    [
        ("64039990", "db_64.db"),
        ("640399", "db_64.db"),
        ("0901", "db_09.db"),
        ("84713000", "db_84b.db"),
        ("842199", "db_84a.db"),
        ("852351", "db_85a.db"),
        ("853400", "db_85b.db"),
        ("850440", "db_85a.db"),
    ],
)
def test_shard_name(code, name):
    assert shards.shard_name(code) == name


@pytest.mark.parametrize("bad", ["", "12", "abcd12", "1234567890"])
def test_shard_name_rejects_non_codes(bad):
    with pytest.raises(ValueError):
        shards.shard_name(bad)


def test_every_chapter_has_a_shard():
    names = {p.name for p in DATABASES_DIR.glob("db_*.db")}
    chapters = [f"{c:02d}" for c in range(1, 98) if c != 77]  # 77 is reserved in the HS
    expected = {f"db_{c}.db" for c in chapters if c not in ("84", "85")}
    expected |= {"db_84a.db", "db_84b.db", "db_85a.db", "db_85b.db"}
    assert expected <= names


def test_hs6_band_carries_tails_history_origin_and_other_basis():
    b = bm.database_benchmark("640399", "pr", "CN")
    assert b is not None and not b.is_mock and b.route is None
    assert (b.level, b.code, b.basis, b.unit) == ("hs6", "640399", "per_unit", "pr")
    assert b.period == "2025"
    assert b.p1 <= b.p5 <= b.p10 <= b.median <= b.p90 <= b.p95 <= b.p99
    assert [h.period for h in b.history] == ["2023", "2024", "2025", "2026", "all"]
    assert all(h.origin == "ALL" and h.basis == "per_unit" for h in b.history)
    assert b.origin_band is not None and b.origin_band.origin == "CN"
    assert b.other_basis is not None and b.other_basis.basis == "per_kg"
    assert b.n_observations >= bm.MIN_PRICES


def test_prices_are_converted_from_gbp_per_period():
    b = bm.database_benchmark("640399", "pr")
    raw = _raw("640399", "hs6", origin="ALL", basis="per_unit", year="2023")
    h2023 = next(h for h in b.history if h.period == "2023")
    assert h2023.median == pytest.approx(raw["median"] * bm.gbp_to_usd("2023"))
    assert bm.gbp_to_usd("2023") != bm.gbp_to_usd("2025")
    assert bm.gbp_to_usd("all") == bm.gbp_to_usd("2026") == bm.gbp_to_usd("2025")


def test_thin_hs6_falls_back_to_its_heading():
    b = bm.database_benchmark("070955", "kg")  # 11 prices at HS6, thousands at HS4 0709
    assert b is not None and (b.level, b.code) == ("hs4", "0709")
    assert b.hs6 == "070955"


def test_no_band_when_even_the_heading_is_thin():
    assert bm.database_benchmark("020500", "kg") is None


def test_per_unit_fallback_needs_the_same_unit():
    assert bm.database_benchmark("090111", "u") is None  # coffee is only priced per kg


def test_units_per_code():
    assert bm.database_units("640399") == ("pr", "kg")
    assert bm.database_units("220210") == ("l", "kg")
    assert bm.database_units("731815") == ("kg",)


@pytest.mark.parametrize(
    ("item", "hs6", "unit"),
    [
        (line(description="Leather boots", unit="pairs"), "640399", "pr"),
        (line(description="Leather boots", unit="pcs"), "640399", "pr"),
        (line(description="Cola 330ml cans", unit="cans"), "220210", "l"),
        (line(description="Cola", unit="kg"), "220210", "kg"),
        (line(description="Laptop", unit="units"), "847130", "u"),
        (line(description="Laptop", unit="kg"), "847130", "kg"),
    ],
)
def test_line_is_priced_in_the_unit_it_converts_to(item, hs6, unit):
    n = normalise(item, hs6, "USD")
    assert n.unit == unit and n.unit_price_usd is not None


def test_pieces_are_half_a_pair():
    n = normalise(line(description="Leather boots", unit="pcs", unit_price=10.0), "640399", "USD")
    assert n.quantity == 50 and n.unit_price_usd == 20.0


def test_benchmark_prefers_the_database(monkeypatch):
    b = bm.benchmark(enriched("847130", "u"), "CN-GB", "CN")
    assert b is not None and b.level == "hs6" and b.origin_band is not None
    monkeypatch.setenv("TBML_BENCHMARKS", "bands")
    legacy = bm.benchmark(enriched("847130", "u"), "CN-GB", "CN")
    assert legacy is not None and legacy.level is None and legacy.route == "CN-GB"


def test_codes_outside_the_databases_fall_back_to_the_band_table(monkeypatch):
    monkeypatch.setenv("TBML_DATABASES_DIR", "/nonexistent")
    assert not bm.database_enabled() and bm.describe_source() == bm.band_file()
    b = bm.benchmark(enriched("847130", "u"))
    assert b is not None and b.level is None


def test_describe_source_counts_shards():
    assert bm.describe_source() == f"database:{shards.shard_count()} shards"
    assert shards.build_info()["latest_full_year"] == "2025"


def test_packed_shards_are_unpacked_on_first_use(tmp_path, monkeypatch):
    folder = tmp_path / "databases"
    folder.mkdir()
    (folder / "db_09.db").write_bytes((DATABASES_DIR / "db_09.db").read_bytes())
    pack_databases.pack(folder / "db_09.db", 1)
    assert [p.name for p in folder.iterdir()] == ["db_09.db.xz"]
    monkeypatch.setenv("TBML_DATABASES_DIR", str(folder))
    monkeypatch.setenv("TBML_DATABASES_CACHE", str(tmp_path / "unpacked"))
    shards.series.cache_clear()
    try:
        assert shards.shard_path("090111") == tmp_path / "unpacked" / "db_09.db"
        rows = shards.series("090111", "hs6")
        assert rows and {r["code"] for r in rows} == {"090111"}
        assert shards.shard_path("640399") is None  # not packed into this folder
    finally:
        shards.series.cache_clear()


def test_any_code_the_classifier_can_return_is_priced():
    """No fixed list: a random sample of the full HS nomenclature (what the AI classifier picks
    from) finds a database band, and a price beyond that band's own p1 / p99 is flagged."""
    sample = random.Random(7).sample(sorted(default_nomenclature().hs6_codes()), 300)
    item = line(unit="kg")
    invoice = Invoice.model_validate({**load_fixture("invoice"), "line_items": [item.model_dump()]})
    priced = 0
    for hs6 in sample:
        n = normalise(item, hs6, "USD")
        if n.unit_price_usd is None:
            continue
        e = enriched(hs6, n.unit)
        b = bm.benchmark(e)
        if b is None or b.level is None:
            continue
        priced += 1
        for price in (b.p99 * 3, b.p1 / 3):
            (flag,) = price_outlier.check(
                invoice, [e.model_copy(update={"unit_price_usd": price})], [b]
            )
            assert flag.evidence["position"].startswith("extreme"), hs6
    assert priced / len(sample) >= 0.95  # the rest are obsolete codes with no UK imports
