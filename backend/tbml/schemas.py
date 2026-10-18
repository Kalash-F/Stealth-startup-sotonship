"""Data contracts (plan.md §4). Single source of truth; frozen.

Changing anything here requires bumping SCHEMA_VERSION, updating every producer,
consumer and fixture, and logging the change in DECISIONS.md (plan.md §0.5).
"""

from __future__ import annotations

import datetime as dt
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = "1.2"

ISO_COUNTRY = r"^[A-Z]{2}$"
ISO_CURRENCY = r"^[A-Z]{3}$"
HS6_PATTERN = r"^\d{6}$"


class _Contract(BaseModel):
    """Base for every contract model: unknown fields are an error."""

    # Unknown fields are rejected so drift from §4 fails loudly.
    model_config = ConfigDict(extra="forbid")


class AddressType(StrEnum):
    """Whether a party's address is a business, a private home, or cannot be told (e.g. a P.O.
    box)."""

    commercial = "commercial"
    residential = "residential"
    unknown = "unknown"


class Severity(StrEnum):
    """How strongly a flag asks for attention. Scoring turns these into points."""

    low = "low"
    medium = "medium"
    high = "high"


class PriorityBand(StrEnum):
    """Review urgency derived from the priority score: never a fraud verdict."""

    review_now = "review_now"
    review = "review"
    low = "low"


class Rule(StrEnum):
    """Rule types R1–R8 (plan.md Phase 4 §4.2)."""

    PRICE_OUTLIER = "PRICE_OUTLIER"
    QTY_VALUE_IMPLAUSIBLE = "QTY_VALUE_IMPLAUSIBLE"
    PLACEHOLDER_DESC = "PLACEHOLDER_DESC"
    GEO_INCONSISTENT = "GEO_INCONSISTENT"
    ROUTE_NO_ECONOMIC_SENSE = "ROUTE_NO_ECONOMIC_SENSE"
    ARITHMETIC_ERROR = "ARITHMETIC_ERROR"
    RESIDENTIAL_CONSIGNEE = "RESIDENTIAL_CONSIGNEE"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"


# §4.1
class Party(_Contract):
    """A named party on the invoice (seller, buyer or consignee). `country` is ISO-3166 alpha-2;
    the extractor uses ZZ when it cannot read one."""

    name: str
    address: str
    country: str = Field(pattern=ISO_COUNTRY, description="ISO-3166 alpha-2")
    address_type: AddressType


# §4.2
class LineItem(_Contract):
    """One goods line exactly as printed, numbers included, even when the arithmetic is wrong.
    `extraction_confidence` is the extractor's own 0-1 estimate that it read the line correctly."""

    line_id: str = Field(pattern=r"^L\d+$")
    description: str
    quantity: float
    unit: str
    unit_price: float
    line_total: float
    extraction_confidence: float = Field(ge=0, le=1)


# §4.3
class Invoice(_Contract):
    """Stage 1 output: everything read from the PDF. Optional fields are None when the document
    does not state them; `consignee` is None when the goods go to the buyer."""

    invoice_id: str
    invoice_date: dt.date
    seller: Party
    buyer: Party
    consignee: Party | None
    country_of_origin: str | None
    port_of_loading: str | None
    port_of_discharge: str | None
    incoterm: str | None
    currency: str = Field(pattern=ISO_CURRENCY, description="ISO-4217")
    line_items: list[LineItem]
    stated_total: float
    source_file: str
    is_synthetic: bool


class HS6Candidate(_Contract):
    """A proposed 6-digit HS commodity code with the proposer's 0-1 score."""

    hs6: str = Field(pattern=HS6_PATTERN)
    score: float = Field(ge=0, le=1)


# §4.4
class EnrichedLine(_Contract):
    """Stage 2 output for one line: HS6 (None if not classifiable), up to three candidates, and
    the quantity and USD price converted to the benchmark unit (None if conversion was not
    possible). `normalisation_note` shows the arithmetic or the reason there is none."""

    line_id: str = Field(pattern=r"^L\d+$")
    hs6: str | None = Field(pattern=HS6_PATTERN)
    hs6_description: str | None
    hs6_candidates: list[HS6Candidate] = Field(max_length=3)
    classification_confidence: float = Field(ge=0, le=1)
    normalised_quantity: float | None
    benchmark_unit: str | None
    unit_price_usd: float | None
    normalisation_note: str


# §4.5
class Benchmark(_Contract):
    """Stage 3 output: a trade unit-value band (USD per `unit`) for an HS6, globally
    (`route` None) or for an ORIGIN-DESTINATION country pair. `is_mock` marks approximate
    stand-ins that are not real trade statistics."""

    hs6: str = Field(pattern=HS6_PATTERN)
    route: str | None = Field(pattern=r"^[A-Z]{2}-[A-Z]{2}$", description="null = global")
    unit: str
    p10: float
    p25: float
    median: float
    p75: float
    p90: float
    n_observations: int = Field(ge=0)
    years: list[int]
    sources: list[str]
    is_mock: bool

    @model_validator(mode="after")
    def _bands_monotonic(self) -> Benchmark:
        if not (self.p10 <= self.p25 <= self.median <= self.p75 <= self.p90):
            raise ValueError("band must satisfy p10 <= p25 <= median <= p75 <= p90")
        return self


# §4.6
class Flag(_Contract):
    """One red flag raised by a rule. `reason` is plain English for the officer; `expected` and
    `stated` are short display strings; `evidence` holds the numbers behind the call.
    `line_id` is None for invoice-level flags."""

    flag_id: str
    rule: Rule
    line_id: str | None = Field(description="null = invoice-level flag")
    severity: Severity
    expected: str | None
    stated: str | None
    variance_pct: float | None
    reason: str = Field(min_length=1)
    evidence: dict[str, Any]


class ReportLine(LineItem, EnrichedLine):
    """One entry of Report.lines: LineItem + EnrichedLine fields flattened, plus the band."""

    benchmark: Benchmark | None


# §4.7
class Report(_Contract):
    """The final response: priority score (0-100) and band, a one-or-two-sentence summary of the
    rest, the invoice as extracted (parties, dates, ports, currency, stated total), flags
    worst-first, every line with its enrichment and band, processing time, and warnings about
    anything skipped or degraded."""

    invoice_id: str
    schema_version: str
    priority_score: float = Field(ge=0, le=100)
    priority_band: PriorityBand
    summary: str | None = Field(description="1-2 sentence overview; null = LLM call failed")
    invoice: Invoice
    flags: list[Flag]
    lines: list[ReportLine]
    processing_ms: int = Field(ge=0)
    warnings: list[str]


__all__ = [
    "SCHEMA_VERSION",
    "AddressType",
    "Benchmark",
    "EnrichedLine",
    "Flag",
    "HS6Candidate",
    "Invoice",
    "LineItem",
    "Party",
    "PriorityBand",
    "Report",
    "ReportLine",
    "Rule",
    "Severity",
]
