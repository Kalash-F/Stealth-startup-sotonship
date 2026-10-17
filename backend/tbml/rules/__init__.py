"""P3: red-flag rules, one file per rule from Phase 4. Phase 0 stub: the report fixture's flags."""

from tbml.fixtures import load_fixture
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice


def run_rules(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
) -> list[Flag]:
    line_ids = {item.line_id for item in invoice.line_items}
    flags = [Flag.model_validate(f) for f in load_fixture("report")["flags"]]
    return [f for f in flags if f.line_id is None or f.line_id in line_ids]


__all__ = ["run_rules"]
