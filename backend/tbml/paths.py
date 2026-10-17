"""Repository paths. Assumes an editable install (`make setup`) so the repo layout is on disk.

The Vercel backend service is bundled from `backend/` alone, so its build copies `data/` into
`backend/data/` (vercel.json) and `DATA_DIR` falls back to that copy.
"""

import os
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
DATA_DIR = REPO_ROOT / "data"
if not DATA_DIR.is_dir():
    DATA_DIR = BACKEND_DIR / "data"
REFERENCE_DIR = DATA_DIR / "reference"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
BENCHMARKS_DIR = DATA_DIR / "benchmarks"
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures"
REPORTS_DIR = DATA_DIR / "reports"


def cache_dir() -> Path:
    """Cache root for LLM replies and classifications: $TBML_CACHE_DIR, else data/cache."""
    return Path(os.environ.get("TBML_CACHE_DIR") or DATA_DIR / "cache")
