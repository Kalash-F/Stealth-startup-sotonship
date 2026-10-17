"""Phase 0 stub stages, kept behind `USE_MOCKS=1` so the frontend can develop without real data."""

from tbml.extract import ExtractionResult
from tbml.fixtures import load_fixture
from tbml.schemas import Benchmark, EnrichedLine, Invoice


def extract_document(path) -> ExtractionResult:
    invoice = Invoice.model_validate(load_fixture("invoice")).model_copy(
        update={"source_file": str(path)}
    )
    return ExtractionResult(invoice, [], "stub")


def benchmark(enriched_line: EnrichedLine, route: str | None = None) -> Benchmark | None:
    band = Benchmark.model_validate(load_fixture("benchmark"))
    return band if enriched_line.hs6 == band.hs6 else None
