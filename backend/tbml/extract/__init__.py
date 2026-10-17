"""P1: PDF -> Invoice. Phase 0 stub: returns the golden invoice fixture."""

from pathlib import Path

from tbml.fixtures import load_fixture
from tbml.schemas import Invoice


def extract(pdf_path: str | Path) -> Invoice:
    invoice = Invoice.model_validate(load_fixture("invoice"))
    return invoice.model_copy(update={"source_file": Path(pdf_path).name})


__all__ = ["extract"]
