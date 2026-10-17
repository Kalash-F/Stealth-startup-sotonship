"""Deployed ASGI app: `tbml.api` mounted under /api, the public path vercel.json routes to the
backend. Vercel forwards the original URL (/api/health, /api/check), so the prefix is handled here
rather than on every route. `make api` still serves the bare app without the prefix.

Vercel mounts the deployed code read-only and only the temp dir is writable, so when data/ cannot
be written the LLM caches and saved reports move there (per instance, lost on a cold start)."""

import os
import tempfile
from pathlib import Path

from fastapi import FastAPI

from tbml.api import app as api
from tbml.paths import DATA_DIR

API_PREFIX = "/api"


def writable_dir_defaults(data_dir: Path) -> dict[str, str]:
    """Env defaults for the cache and report dirs: none when `data_dir` is writable, else the
    temp dir. Explicit TBML_CACHE_DIR / TBML_REPORTS_DIR settings still win."""
    if os.access(data_dir, os.W_OK):
        return {}
    tmp = Path(tempfile.gettempdir()) / "tbml"
    return {"TBML_CACHE_DIR": str(tmp / "cache"), "TBML_REPORTS_DIR": str(tmp / "reports")}


for _key, _value in writable_dir_defaults(DATA_DIR).items():
    os.environ.setdefault(_key, _value)

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount(API_PREFIX, api)
