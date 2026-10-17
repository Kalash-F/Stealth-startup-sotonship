"""Repository paths. Assumes an editable install (`make setup`) so the repo layout is on disk."""

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PACKAGE_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
DATA_DIR = REPO_ROOT / "data"
REFERENCE_DIR = DATA_DIR / "reference"
SYNTHETIC_DIR = DATA_DIR / "synthetic"
BENCHMARKS_DIR = DATA_DIR / "benchmarks"
FIXTURES_DIR = BACKEND_DIR / "tests" / "fixtures"
REPORTS_DIR = DATA_DIR / "reports"
