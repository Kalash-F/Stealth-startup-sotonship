"""Phase 4 checkpoint: run every rule on the truth invoices (extraction and classification bypassed)
and report per-rule precision and recall against labels.csv. Run with `-s` to see the tables.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict

import pytest

from tbml.paths import REFERENCE_DIR, SYNTHETIC_DIR
from tbml.rules import RULES, run_rules
from tbml.schemas import Benchmark, EnrichedLine, Flag, Invoice, Rule
from tbml.score import score
from tbml.synthetic.catalogue import COMMODITIES

# The label a rule is expected to catch. OVER_PRICE and UNDER_PRICE both belong to R1.
LABEL_TO_RULE = {
    "OVER_PRICE": Rule.PRICE_OUTLIER,
    "UNDER_PRICE": Rule.PRICE_OUTLIER,
    "QTY_VALUE_IMPLAUSIBLE": Rule.QTY_VALUE_IMPLAUSIBLE,
    "PLACEHOLDER_DESC": Rule.PLACEHOLDER_DESC,
    "GEO_INCONSISTENT": Rule.GEO_INCONSISTENT,
    "ROUTE_NO_ECONOMIC_SENSE": Rule.ROUTE_NO_ECONOMIC_SENSE,
    "ARITHMETIC_ERROR": Rule.ARITHMETIC_ERROR,
    "RESIDENTIAL_CONSIGNEE": Rule.RESIDENTIAL_CONSIGNEE,
}
# Planted QTY_VALUE lines are also extreme price outliers (DECISIONS D1.7), and a huge OVER_PRICE
# can also exceed the R2 ceiling. A flag on such a line is explained, not a false positive.
ALSO_EXPLAINS = {
    Rule.PRICE_OUTLIER: {"QTY_VALUE_IMPLAUSIBLE"},
    Rule.QTY_VALUE_IMPLAUSIBLE: {"OVER_PRICE"},
}
RECALL_TARGET = 0.9
CLEAN_HARD_FP_TARGET = 0.2


def _read(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def _bands() -> dict[str, Benchmark]:
    # The same placeholder bands the generator priced the invoices from (DECISIONS D1.2).
    data = json.loads((REFERENCE_DIR / "placeholder_bands.json").read_text())
    return {b["hs6"]: Benchmark.model_validate(b) for b in data}


@pytest.fixture(scope="module")
def results():
    bands = _bands()
    lines_by_invoice = defaultdict(list)
    for row in _read(SYNTHETIC_DIR / "lines.csv"):
        lines_by_invoice[row["invoice_id"]].append(row)
    out = {}
    for path in sorted((SYNTHETIC_DIR / "truth").glob("*.json")):
        invoice = Invoice.model_validate_json(path.read_text())
        enriched, benchmarks = [], []
        for row in lines_by_invoice[invoice.invoice_id]:
            hs6 = row["hs6"] or None  # empty = placeholder line the classifier cannot place
            enriched.append(
                EnrichedLine(
                    line_id=row["line_id"],
                    hs6=hs6,
                    hs6_description=COMMODITIES[hs6].name if hs6 else None,
                    hs6_candidates=[],
                    classification_confidence=1.0 if hs6 else 0.0,
                    normalised_quantity=float(row["normalised_quantity"]) if hs6 else None,
                    benchmark_unit=row["benchmark_unit"] if hs6 else None,
                    unit_price_usd=float(row["unit_price_usd"]) if hs6 else None,
                    normalisation_note="truth data",
                )
            )
            benchmarks.append(bands[hs6] if hs6 else None)
        out[invoice.invoice_id] = run_rules(invoice, enriched, benchmarks)
    return out


@pytest.fixture(scope="module")
def labels():
    rows = _read(SYNTHETIC_DIR / "labels.csv")
    planted = [r for r in rows if r["label"]]
    hard = {r["invoice_id"] for r in rows if r["hard_negative"] == "CLEAN_HARD"}
    return planted, hard


def _hit(flag: Flag, label_row: dict) -> bool:
    """Does this flag land on this planted anomaly (same line for line-level labels)?"""
    return flag.line_id == (label_row["line_id"] or None)


def _per_rule(results, planted):
    stats = {}
    for rule in Rule:
        labels = (
            [r for r in planted if LABEL_TO_RULE[r["label"]] == rule]
            if rule != Rule.LOW_CONFIDENCE
            else []
        )
        caught = [
            r
            for r in labels
            if any(f.rule == rule and _hit(f, r) for f in results[r["invoice_id"]])
        ]
        explaining = {r["label"] for r in labels} | ALSO_EXPLAINS.get(rule, set())
        flags = [(inv, f) for inv, fl in results.items() for f in fl if f.rule == rule]
        true_flags = [
            (inv, f)
            for inv, f in flags
            if any(
                r["invoice_id"] == inv and r["label"] in explaining and _hit(f, r) for r in planted
            )
        ]
        stats[rule] = (len(labels), len(caught), len(flags), len(true_flags), labels, caught)
    return stats


def test_every_rule_recall_and_precision(results, labels, capsys):
    planted, _ = labels
    stats = _per_rule(results, planted)
    with capsys.disabled():
        print("\n\nRule                       planted caught recall | flags true precision")
        for rule, (n, c, f, t, _, _) in stats.items():
            recall = f"{c / n:6.2f}" if n else "   n/a"
            precision = f"{t / f:6.2f}" if f and n else "   n/a"
            print(f"{rule.value:27}{n:7}{c:7} {recall} | {f:5}{t:5} {precision}")
    for rule, (n, c, *_) in stats.items():
        if n:
            assert c / n >= RECALL_TARGET, f"{rule.value} recall {c}/{n} below {RECALL_TARGET}"


def test_missed_anomalies_are_listed(results, labels, capsys):
    planted, _ = labels
    stats = _per_rule(results, planted)
    missed = [
        (rule.value, r["invoice_id"], r["line_id"], r["detail"])
        for rule, (_, _, _, _, lab, caught) in stats.items()
        for r in lab
        if r not in caught
    ]
    with capsys.disabled():
        print("\nMissed planted anomalies:", missed or "none")


def test_clean_hard_false_positives(results, labels, capsys):
    _, hard = labels
    fps = {inv: results[inv] for inv in hard if results[inv]}
    with capsys.disabled():
        print(f"\nCLEAN_HARD invoices flagged: {len(fps)}/{len(hard)}")
        for inv, flags in fps.items():
            for f in flags:
                print(f"  {inv} {f.rule.value} {f.line_id} {f.severity.value}: {f.reason}")
    assert len(fps) / len(hard) <= CLEAN_HARD_FP_TARGET


def test_plain_clean_invoices_are_not_flagged(results, labels, capsys):
    planted, hard = labels
    anomalous = {r["invoice_id"] for r in planted}
    clean = [inv for inv in results if inv not in anomalous and inv not in hard]
    flagged = {inv: results[inv] for inv in clean if results[inv]}
    with capsys.disabled():
        print(f"\nPlain clean invoices flagged: {len(flagged)}/{len(clean)}")
        for inv, flags in flagged.items():
            for f in flags:
                print(f"  {inv} {f.rule.value} {f.line_id} {f.severity.value}: {f.reason}")
    assert not flagged


def test_anomalous_invoices_outscore_clean_ones(results, labels):
    planted, hard = labels
    anomalous = {r["invoice_id"] for r in planted}
    bad = [score(results[i])[0] for i in anomalous]
    clean = [score(f)[0] for i, f in results.items() if i not in anomalous and i not in hard]
    assert min(bad) > max(clean)


def test_every_flag_validates_and_explains_itself(results):
    for flags in results.values():
        for f in flags:
            assert f.reason.strip() and f.evidence
            Flag.model_validate(f.model_dump())


def test_all_rules_registered():
    assert len(RULES) == len(Rule)
