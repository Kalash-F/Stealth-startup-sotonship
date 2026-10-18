"""Every §4 contract has a golden fixture that validates, and bad inputs are rejected."""

import copy

import pytest
from pydantic import BaseModel, ValidationError

from tbml.fixtures import load_fixture
from tbml.schemas import (
    SCHEMA_VERSION,
    Benchmark,
    EnrichedLine,
    Flag,
    Invoice,
    LineItem,
    Party,
    Report,
)

CONTRACTS: list[tuple[str, type[BaseModel]]] = [
    ("party", Party),
    ("line_item", LineItem),
    ("invoice", Invoice),
    ("enriched_line", EnrichedLine),
    ("benchmark", Benchmark),
    ("flag", Flag),
    ("report", Report),
]

# Field names exactly as written in plan.md §4 (ReportLine is LineItem + EnrichedLine + benchmark).
EXPECTED_FIELDS = {
    Party: ["name", "address", "country", "address_type"],
    LineItem: [
        "line_id", "description", "quantity", "unit", "unit_price", "line_total",
        "extraction_confidence",
    ],
    Invoice: [
        "invoice_id", "invoice_date", "seller", "buyer", "consignee", "country_of_origin",
        "port_of_loading", "port_of_discharge", "incoterm", "currency", "line_items",
        "stated_total", "source_file", "is_synthetic",
    ],
    EnrichedLine: [
        "line_id", "hs6", "hs6_description", "hs6_candidates", "classification_confidence",
        "normalised_quantity", "benchmark_unit", "unit_price_usd", "normalisation_note",
    ],
    Benchmark: [
        "hs6", "route", "unit", "p10", "p25", "median", "p75", "p90", "n_observations",
        "years", "sources", "is_mock",
    ],
    Flag: [
        "flag_id", "rule", "line_id", "severity", "expected", "stated", "variance_pct",
        "reason", "evidence",
    ],
    Report: [
        "invoice_id", "schema_version", "priority_score", "priority_band", "summary", "flags",
        "lines", "processing_ms", "warnings",
    ],
}  # fmt: skip


def test_schema_version():
    assert SCHEMA_VERSION == "1.1"


@pytest.mark.parametrize("model", list(EXPECTED_FIELDS))
def test_field_names_match_plan(model):
    assert sorted(model.model_fields) == sorted(EXPECTED_FIELDS[model])


@pytest.mark.parametrize(("name", "model"), CONTRACTS)
def test_fixture_validates_and_roundtrips(name, model):
    data = load_fixture(name)
    obj = model.model_validate(data)
    assert model.model_validate_json(obj.model_dump_json()) == obj


def test_fixtures_are_synthetic():
    assert load_fixture("invoice")["is_synthetic"] is True
    assert load_fixture("benchmark")["is_mock"] is True


@pytest.mark.parametrize(("name", "model"), CONTRACTS)
def test_missing_field_rejected(name, model):
    data = load_fixture(name)
    for field in model.model_fields:
        broken = copy.deepcopy(data)
        broken.pop(field)
        with pytest.raises(ValidationError):
            model.model_validate(broken)


@pytest.mark.parametrize(("name", "model"), CONTRACTS)
def test_unknown_field_rejected(name, model):
    data = load_fixture(name) | {"not_in_contract": 1}
    with pytest.raises(ValidationError):
        model.model_validate(data)


WRONG_TYPES = [
    ("party", Party, "country", 44),
    ("line_item", LineItem, "quantity", "lots"),
    ("line_item", LineItem, "unit_price", [1.0]),
    ("invoice", Invoice, "invoice_date", "14th of March"),
    ("invoice", Invoice, "line_items", {"L1": {}}),
    ("invoice", Invoice, "is_synthetic", "perhaps"),
    ("enriched_line", EnrichedLine, "hs6_candidates", "731815"),
    ("benchmark", Benchmark, "n_observations", 12.5),
    ("benchmark", Benchmark, "years", "2024"),
    ("flag", Flag, "evidence", "see notes"),
    ("report", Report, "processing_ms", "fast"),
    ("report", Report, "flags", [{"flag_id": "F1"}]),
]


@pytest.mark.parametrize(("name", "model", "field", "value"), WRONG_TYPES)
def test_wrong_type_rejected(name, model, field, value):
    data = load_fixture(name) | {field: value}
    with pytest.raises(ValidationError):
        model.model_validate(data)


BAD_VALUES = [
    ("party", Party, "address_type", "office"),
    ("party", Party, "country", "GBR"),
    ("line_item", LineItem, "line_id", "line-1"),
    ("line_item", LineItem, "extraction_confidence", 1.2),
    ("invoice", Invoice, "currency", "usd"),
    ("enriched_line", EnrichedLine, "hs6", "7318"),
    ("enriched_line", EnrichedLine, "classification_confidence", -0.1),
    ("benchmark", Benchmark, "route", "China-UK"),
    ("benchmark", Benchmark, "median", 100.0),  # breaks p10 <= ... <= p90
    ("flag", Flag, "rule", "PRICE_TOO_HIGH"),
    ("flag", Flag, "severity", "critical"),
    ("report", Report, "priority_band", "urgent"),
    ("report", Report, "priority_score", 101),
]


@pytest.mark.parametrize(("name", "model", "field", "value"), BAD_VALUES)
def test_bad_enum_or_range_rejected(name, model, field, value):
    data = load_fixture(name) | {field: value}
    with pytest.raises(ValidationError):
        model.model_validate(data)


def test_too_many_hs6_candidates_rejected():
    data = load_fixture("enriched_line")
    data["hs6_candidates"] = data["hs6_candidates"] + [{"hs6": "731819", "score": 0.01}]
    with pytest.raises(ValidationError):
        EnrichedLine.model_validate(data)


def test_nullable_fields_accept_null():
    inv = load_fixture("invoice") | {
        "consignee": None,
        "country_of_origin": None,
        "port_of_loading": None,
        "port_of_discharge": None,
        "incoterm": None,
    }
    Invoice.model_validate(inv)
    unclassified = load_fixture("enriched_line") | {
        "hs6": None,
        "hs6_description": None,
        "hs6_candidates": [],
        "normalised_quantity": None,
        "benchmark_unit": None,
        "unit_price_usd": None,
    }
    EnrichedLine.model_validate(unclassified)
    Benchmark.model_validate(load_fixture("benchmark") | {"route": None})
    Flag.model_validate(load_fixture("flag") | {"line_id": None, "expected": None})
    report = load_fixture("report")
    report["lines"][0]["benchmark"] = None
    Report.model_validate(report)
