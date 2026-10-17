"""Load golden fixtures from backend/tests/fixtures. Used by the Phase 0 stubs."""

import json
from typing import Any

from tbml.paths import FIXTURES_DIR


def load_fixture(name: str) -> Any:
    """Return the parsed JSON of `backend/tests/fixtures/{name}.json`."""
    return json.loads((FIXTURES_DIR / f"{name}.json").read_text())
