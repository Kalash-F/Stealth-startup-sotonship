"""Phase 0: every stage exists as a stub and mock data flows end to end."""

import pytest
from fastapi.testclient import TestClient

from tbml.api import app
from tbml.benchmark import benchmark
from tbml.classify import enrich
from tbml.extract import ExtractionResult
from tbml.fixtures import load_fixture
from tbml.pipeline import check
from tbml.rules import run_rules
from tbml.schemas import (
    SCHEMA_VERSION,
    Benchmark,
    EnrichedLine,
    Flag,
    Invoice,
    PriorityBand,
    Report,
)
from tbml.score import score


def _stub_invoice(path) -> Invoice:
    return Invoice.model_validate(load_fixture("invoice")).model_copy(
        update={"source_file": str(path)}
    )


@pytest.fixture(autouse=True)
def stub_extraction(monkeypatch):
    """Phase 0 tests exercise the downstream stubs with fixture data, not real PDF parsing."""
    monkeypatch.setattr(
        "tbml.pipeline.extract_document", lambda path: ExtractionResult(_stub_invoice(path))
    )


def test_stages_return_contract_types():
    invoice = _stub_invoice("any.pdf")
    assert isinstance(invoice, Invoice)
    assert invoice.source_file == "any.pdf"

    enriched = enrich(invoice)
    assert [e.line_id for e in enriched] == [i.line_id for i in invoice.line_items]
    assert all(isinstance(e, EnrichedLine) for e in enriched)

    bands = [benchmark(e) for e in enriched]
    assert all(b is None or isinstance(b, Benchmark) for b in bands)

    flags = run_rules(invoice, enriched, bands)
    assert flags and all(isinstance(f, Flag) for f in flags)

    s, band = score(flags)
    assert 0 <= s <= 100
    assert isinstance(band, PriorityBand)


def test_check_returns_valid_report():
    report = check("any.pdf")
    assert isinstance(report, Report)
    assert report.schema_version == SCHEMA_VERSION
    assert len(report.lines) == 2
    assert report.lines[0].benchmark is not None
    Report.model_validate_json(report.model_dump_json())


def test_api_health_and_stub_check():
    client = TestClient(app)
    assert client.get("/health").json()["status"] == "ok"
    resp = client.post("/check", files={"file": ("x.pdf", b"%PDF-1.4 stub", "application/pdf")})
    assert resp.status_code == 200
    Report.model_validate(resp.json())
