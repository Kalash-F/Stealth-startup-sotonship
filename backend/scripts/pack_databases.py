"""Compress the benchmark database shards for the deployed bundle (DECISIONS DV5).

The 98 shards in data/databases are about 246 MB, more than the Vercel function can hold next to
the code (DV1). The backend's build copies data/ into backend/data/ and runs this on the copy:
each `db_XX.db` becomes `db_XX.db.xz` (about 35% of the size) and the original is removed.
`tbml.benchmark.shards` unpacks a shard into the temp dir the first time a lookup needs it.

Run:  python scripts/pack_databases.py data/databases   (from backend/, on the build copy only)
"""

from __future__ import annotations

import argparse
import lzma
import os
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path


def pack(path: Path, preset: int) -> tuple[str, int, int]:
    """Write `path`.xz next to `path`, then delete `path`. Returns (name, bytes in, bytes out)."""
    target = path.with_name(path.name + ".xz")
    tmp = target.with_name(target.name + ".part")
    with open(path, "rb") as src, lzma.open(tmp, "wb", preset=preset) as dst:
        shutil.copyfileobj(src, dst, 1 << 20)
    os.replace(tmp, target)
    size = path.stat().st_size
    path.unlink()
    return path.name, size, target.stat().st_size


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("folder", type=Path, help="folder holding db_*.db (the build copy)")
    ap.add_argument("--preset", type=int, default=6, help="xz preset, 0-9 (default 6)")
    args = ap.parse_args()
    shards = sorted(args.folder.glob("db_*.db"))
    if not shards:
        print(f"no db_*.db in {args.folder}, nothing to pack")
        return
    if (args.folder.resolve() / ".." / "..").resolve() == Path(__file__).resolve().parents[2]:
        sys.exit("refusing to pack the repository's own data/databases; run it on the build copy")
    total_in = total_out = 0
    with ProcessPoolExecutor() as pool:
        for name, size_in, size_out in pool.map(pack, shards, [args.preset] * len(shards)):
            total_in += size_in
            total_out += size_out
            print(f"{name}: {size_in / 1e6:.1f} MB -> {size_out / 1e6:.1f} MB")
    print(f"{len(shards)} shards: {total_in / 1e6:.0f} MB -> {total_out / 1e6:.0f} MB")


if __name__ == "__main__":
    main()
