"""Repository paths. Assumes an editable install (`make setup`) so the repo layout is on disk.

The Vercel backend service is bundled from `backend/` alone, so its build copies `data/` into
`backend/data/` (vercel.json) and `DATA_DIR` falls back to that copy.
"""

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
# The first candidate that holds the band tables wins, so a stray empty data/ next to the
# bundle cannot hide the copy the build made.
_CANDIDATES = (REPO_ROOT / "data", BACKEND_DIR / "data")
DATA_DIR = next(
    (d for d in _CANDIDATES if (d / "benchmarks" / "bands_mock.json").is_file()),
    next((d for d in _CANDIDATES if d.is_dir()), _CANDIDATES[0]),
)
REFERENCE_DIR = DATA_DIR / "reference"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
BENCHMARKS_DIR = DATA_DIR / "benchmarks"
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures"
REPORTS_DIR = DATA_DIR / "reports"


def cache_dir() -> Path:
    """Cache root for LLM replies and classifications: $TBML_CACHE_DIR, else data/cache."""
    return Path(os.environ.get("TBML_CACHE_DIR") or DATA_DIR / "cache")
