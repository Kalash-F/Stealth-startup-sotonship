"""Read the sharded HMRC benchmark databases in data/databases (one SQLite file per HS chapter).

Each `db_<chapter>.db` holds the price distributions of UK imports for that chapter
(HMRC Overseas Trade Statistics, 2023 to the latest month): table `benchmarks`, one row per
(code, level, basis, recommended, origin, unit, year), prices in GBP. Chapters 84 and 85 are
split again on the code's third digit (`db_84a.db` for 840-842, `db_84b.db` for 843-849), so a
code, its HS6 and its HS4 always live in the same file and every lookup opens exactly one file.

The deployed backend ships each shard compressed as `db_XX.db.xz` (Vercel caps the bundle size,
DECISIONS DV5). A compressed shard is unpacked once into the temp dir on first use.
"""

from __future__ import annotations

import lzma
import os
import re
import shutil
import sqlite3
import tempfile
import threading
from contextlib import closing
from functools import lru_cache
from pathlib import Path

from tbml.paths import databases_dir

_CODE = re.compile(r"^\d{4,8}$")
_unpack_lock = threading.Lock()

# The columns lookups read, in this order (see `Row`).
COLUMNS = (
    "level, code, origin, basis, unit, year, recommended, months, n_prices, "
    "p1, p5, p10, p25, median, p75, p90, p95, p99, median_vs_prev_year"
)
Row = dict[str, str | int | float | None]


def shard_name(code: str) -> str:
    """Shard file for a commodity code: `db_64.db` for '64039990', `db_84b.db` for '847130'."""
    code = code.strip()
    if not _CODE.match(code):
        raise ValueError(f"not a commodity code: {code!r}")
    chapter = code[:2]
    suffix = ("a" if code[2] < "3" else "b") if chapter in ("84", "85") else ""
    return f"db_{chapter}{suffix}.db"


def _unpacked_dir() -> Path:
    return Path(
        os.environ.get("TBML_DATABASES_CACHE") or Path(tempfile.gettempdir()) / "tbml" / "databases"
    )


def shard_path(code: str) -> Path | None:
    """Path of the readable SQLite file for `code`, unpacking `.db.xz` if that is all there is.
    None when the chapter has no shard (e.g. chapter 77, reserved) or the folder is missing."""
    name = shard_name(code)
    plain = databases_dir() / name
    if plain.is_file():
        return plain
    packed = plain.with_name(name + ".xz")
    if not packed.is_file():
        return None
    target = _unpacked_dir() / name
    with _unpack_lock:
        if not target.is_file():
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_name(f"{name}.{os.getpid()}.part")
            with lzma.open(packed) as src, open(tmp, "wb") as dst:
                shutil.copyfileobj(src, dst, 1 << 20)
            os.replace(tmp, target)
    return target


def available() -> bool:
    """True when the database folder holds at least one shard (plain or compressed)."""
    folder = databases_dir()
    return folder.is_dir() and any(folder.glob("db_*.db*"))


def shard_count() -> int:
    """Number of shards present, for /health."""
    folder = databases_dir()
    if not folder.is_dir():
        return 0
    return len({p.name.removesuffix(".xz") for p in folder.glob("db_*.db*")})


def _connect(path: Path) -> sqlite3.Connection:
    # immutable=1: the files never change while the app runs, so SQLite skips locking, which also
    # makes them readable from a read-only filesystem (Vercel).
    conn = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


@lru_cache(maxsize=4096)
def series(code: str, level: str) -> tuple[Row, ...]:
    """Every row stored for one code at one level (all origins, bases, units and years).

    One clustered-key range scan (`code` leads the primary key). Cached: the files are static."""
    path = shard_path(code)
    if path is None:
        return ()
    with closing(_connect(path)) as conn:
        rows = conn.execute(
            f"SELECT {COLUMNS} FROM benchmarks WHERE code = ? AND level = ?", (code, level)
        ).fetchall()
    return tuple(dict(r) for r in rows)


@lru_cache(maxsize=4096)
def supp_unit(cn8: str) -> str | None:
    """HMRC supplementary unit of a CN8 code ('NO', 'LTR', 'PR', ...) from `commodities`."""
    path = shard_path(cn8)
    if path is None:
        return None
    with closing(_connect(path)) as conn:
        row = conn.execute("SELECT supp_unit FROM commodities WHERE cn8 = ?", (cn8,)).fetchone()
    return row["supp_unit"] if row else None


@lru_cache(maxsize=1)
def build_info() -> dict[str, str]:
    """The `build_info` table (replicated in every shard): window, latest full year, counts."""
    folder = databases_dir()
    for candidate in sorted(folder.glob("db_*.db*")) if folder.is_dir() else []:
        path = shard_path(candidate.name.removeprefix("db_")[:2] + "00")
        if path is None:
            continue
        with closing(_connect(path)) as conn:
            return {k: v for k, v in conn.execute("SELECT key, value FROM build_info")}
    return {}


__all__ = [
    "Row",
    "available",
    "build_info",
    "series",
    "shard_count",
    "shard_name",
    "shard_path",
    "supp_unit",
]
