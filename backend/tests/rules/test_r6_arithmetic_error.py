from rules_helpers import make_invoice, make_line

from tbml.rules import arithmetic_error as r6
from tbml.rules._common import config
from tbml.schemas import Rule, Severity

CFG = config("arithmetic_error")


def run(lines, **fields):
    return r6.check(make_invoice(lines, **fields), [], [])


def test_line_total_mismatch_is_flagged():
    (flag,) = run([make_line(quantity=100, unit_price=10, line_total=1500)])
    assert flag.rule == Rule.ARITHMETIC_ERROR and flag.line_id == "L1"
    assert flag.severity == Severity.high  # 50% off
    assert "should come to 1,000.00" in flag.reason and "1,500.00" in flag.reason
    assert flag.evidence["computed_total"] == 1000.0


def test_small_but_real_error_is_medium():
    (flag,) = run([make_line(quantity=100, unit_price=100, line_total=10_500)])  # 5% off
    assert flag.severity == Severity.medium


def test_stated_total_not_matching_lines_is_flagged_at_invoice_level():
    (flag,) = run([make_line()], stated_total=99999.0)
    assert flag.line_id is None
    assert "invoice total does not match" in flag.reason
    assert flag.evidence["sum_of_lines"] == 3800.0


def test_exact_invoice_is_clean():
    assert run([make_line(), make_line("L2", quantity=3, unit_price=1.1, line_total=3.3)]) == []


def test_within_relative_tolerance_not_flagged():
    ok = 100_000 * (1 + CFG["tolerance_pct"] / 100 * 0.99)
    assert run([make_line(quantity=100_000, unit_price=1.0, line_total=ok)], stated_total=ok) == []


def test_exactly_at_relative_tolerance_is_not_flagged():
    expected = 100_000.0
    exact = expected * CFG["tolerance_pct"] / 100  # 500 on 100,000
    line = make_line(quantity=100_000, unit_price=1.0, line_total=expected + exact)
    assert run([line]) == []
    line = make_line(quantity=100_000, unit_price=1.0, line_total=expected + exact * 1.01)
    assert [f.line_id for f in run([line])] == ["L1"]


def test_small_values_use_the_absolute_tolerance():
    unit = CFG["tolerance_abs"]
    assert run([make_line(quantity=2, unit_price=3, line_total=6 + unit)]) == []
    assert len(run([make_line(quantity=2, unit_price=3, line_total=6 + unit * 1.5)])) == 1


def test_zero_lines_and_zero_total_do_not_crash():
    assert run([make_line(quantity=0, unit_price=0, line_total=0)], stated_total=0) == []
