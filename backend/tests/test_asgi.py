"""The deployed app serves `tbml.api` under /api, matching the vercel.json rewrite."""

import tempfile

from fastapi.testclient import TestClient

from tbml.asgi import app, writable_dir_defaults
from tbml.paths import SYNTHETIC_DIR
from tbml.schemas import Report

client = TestClient(app)


def test_routes_are_under_api_prefix():
    assert client.get("/api/health").json()["status"] == "ok"
    pdf = sorted((SYNTHETIC_DIR / "pdfs").glob("*.pdf"))[0]
    resp = client.post(
        "/api/check", files={"file": (pdf.name, pdf.read_bytes(), "application/pdf")}
    )
    assert resp.status_code == 200
    Report.model_validate(resp.json())


def test_unprefixed_paths_are_not_served():
    assert client.get("/health").status_code == 404


def test_openapi_docs_live_under_prefix():
    assert client.get("/api/openapi.json").status_code == 200
    assert "/api/openapi.json" in client.get("/api/docs").text


def test_caches_stay_in_data_dir_when_it_is_writable(tmp_path):
    assert writable_dir_defaults(tmp_path) == {}


def test_caches_move_to_temp_dir_when_data_dir_is_not_writable(tmp_path):
    defaults = writable_dir_defaults(tmp_path / "missing")
    assert set(defaults) == {"TBML_CACHE_DIR", "TBML_REPORTS_DIR"}
    assert all(v.startswith(tempfile.gettempdir()) for v in defaults.values())
