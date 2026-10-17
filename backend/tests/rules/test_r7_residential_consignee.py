from rules_helpers import make_enriched, make_invoice, make_line, party

from tbml.rules import residential_consignee as r7
from tbml.rules._common import config, fx_units_per_usd
from tbml.schemas import Rule, Severity

CFG = config("residential_consignee")


def run(total_usd, consignee=None, buyer=None, currency="USD", enriched=None):
    rate = fx_units_per_usd()[currency]
    line = make_line(quantity=1, unit_price=total_usd * rate, line_total=total_usd * rate)
    fields = {"currency": currency, "consignee": consignee}
    if buyer is not None:
        fields["buyer"] = buyer
    inv = make_invoice([line], **fields)
    return r7.check(inv, enriched or [], [])


HOME = party(
    name="J. Okafor", address="Flat 3, 12 Larkspur Road, Leeds LS6 1AB", address_type="residential"
)


def test_residential_consignee_over_threshold_is_flagged():
    (flag,) = run(CFG["min_total_usd"] * 2, consignee=HOME)
    assert flag.rule == Rule.RESIDENTIAL_CONSIGNEE and flag.line_id is None
    assert flag.severity == Severity.medium
    assert "J. Okafor" in flag.reason and "private home" in flag.reason
    assert flag.evidence["party_role"] == "consignee"


def test_very_large_shipment_to_a_home_is_high():
    (flag,) = run(CFG["high_total_usd"] * 2, consignee=HOME)
    assert flag.severity == Severity.high


def test_residential_buyer_counts_when_there_is_no_residential_consignee():
    (flag,) = run(CFG["min_total_usd"] * 2, buyer=HOME)
    assert flag.evidence["party_role"] == "buyer" and flag.severity == Severity.medium


def test_commercial_consignee_not_flagged():
    assert run(CFG["min_total_usd"] * 10, consignee=party()) == []
    assert run(CFG["min_total_usd"] * 10) == []


def test_below_threshold_not_flagged():
    assert run(CFG["min_total_usd"] / 2, consignee=HOME) == []


def test_exactly_at_threshold_not_flagged():
    assert run(CFG["min_total_usd"], consignee=HOME) == []


def test_non_usd_total_is_converted():
    # 20,000 GBP is ~25.6k USD: over the threshold only after conversion.
    assert len(run(CFG["min_total_usd"] * 1.1, consignee=HOME, currency="GBP")) == 1


def test_unknown_currency_without_enrichment_skips_with_warning():
    inv = make_invoice([make_line()], currency="XXX", consignee=HOME)
    warnings: list[str] = []
    assert r7.check(inv, [], [], warnings) == []
    assert len(warnings) == 1


def test_unknown_currency_falls_back_to_enriched_values():
    inv = make_invoice([make_line()], currency="XXX", consignee=HOME)
    big = make_enriched(unit_price_usd=CFG["min_total_usd"] * 2, normalised_quantity=1.0)
    assert len(r7.check(inv, [big], [])) == 1
