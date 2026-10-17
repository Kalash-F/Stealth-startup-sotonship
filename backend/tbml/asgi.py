"""Deployed ASGI app: `tbml.api` mounted under /api, the public path vercel.json routes to the
backend. Vercel forwards the original URL (/api/health, /api/check), so the prefix is handled here
rather than on every route. `make api` still serves the bare app without the prefix."""

from fastapi import FastAPI

from tbml.api import app as api

API_PREFIX = "/api"

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount(API_PREFIX, api)
