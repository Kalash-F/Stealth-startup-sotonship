import pytest
from rules_helpers import make_invoice, party

from tbml.rules import geo_inconsistent as r4
from tbml.schemas import Rule, Severity


def run(origin, loading="Ningbo, China", seller_cc="CN"):
    inv = make_invoice(
        country_of_origin=origin,
        port_of_loading=loading,
        seller=party(country=seller_cc),
    )
    return r4.check(inv, [], [])


def test_city_in_wrong_country_is_high():
    (flag,) = run("Plzeň, United Kingdom", loading="Felixstowe, United Kingdom", seller_cc="GB")
    assert flag.rule == Rule.GEO_INCONSISTENT and flag.line_id is None
    assert flag.severity == Severity.high
    assert "Plzeň is in Czech Republic" in flag.reason
    assert flag.evidence["check"] == "city_vs_country"


def test_unexplained_third_country_origin_is_medium():
    (flag,) = run("Vietnam")
    assert flag.severity == Severity.medium
    assert "Vietnam" in flag.reason and "China" in flag.reason
    assert flag.evidence["check"] == "origin_vs_loading"


@pytest.mark.parametrize(
    "origin",
    [
        "China",
        "People's Republic of China",
        "P.R. China",
        "Made in China",
        "Shanghai, China",
        "Shanghai",
        "CHINA",
    ],
)
def test_consistent_origin_not_flagged(origin):
    assert run(origin) == []


@pytest.mark.parametrize(
    "origin",
    [
        "Vietnam (transhipped through Felixstowe; certificate of origin attached)",
        "India (re-exported from Jebel Ali Free Zone, Dubai; certificate of origin attached)",
        "Vietnam, re-exported via Dubai",
        "Turkey transshipped at Port Klang",
    ],
)
def test_explained_reexport_or_transhipment_not_flagged(origin):
    assert run(origin) == []


def test_falls_back_to_seller_country_without_a_port():
    (flag,) = run("Vietnam", loading=None)
    assert flag.evidence["reference_basis"] == "seller_country"
    assert run("China", loading=None) == []


def test_unrecognised_port_falls_back_to_seller_country():
    assert run("China", loading="Port Nowhere") == []
    assert len(run("Vietnam", loading="Port Nowhere")) == 1


def test_missing_or_unreadable_origin_not_flagged():
    assert run(None) == []
    assert run("") == []
    assert run("see packing list") == []


def test_dubai_loading_port_with_uae_origin():
    assert run("United Arab Emirates", loading="Jebel Ali, Dubai, UAE", seller_cc="AE") == []
    assert run("U.A.E.", loading="Khalifa Port, Abu Dhabi, UAE", seller_cc="AE") == []
