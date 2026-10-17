"""evaluate.py runs offline: keyword classification on the eval set and the pipeline detection."""

import importlib.util
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "evaluate.py"


def _load():
    spec = importlib.util.spec_from_file_location("evaluate", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_classification_eval_runs_offline():
    a = _load().part_a()
    kw = a["methods"]["keyword"]
    assert a["n_lines"] >= 40 and kw["ran"]
    assert kw["goods_total"] + kw["vague_total"] == a["n_lines"]
    assert kw["vague_left_unclassified"] == kw["vague_total"]  # placeholders never get a code
    assert "flat" not in a["methods"]  # no provider in tests


def test_detection_eval_beats_random_at_20_percent():
    b = _load().part_b(use_llm=False)
    assert b["n_invoices"] == 60
    at20 = next(r for r in b["review_budget"] if r["budget"] == 0.20)
    assert at20["ours_caught"] > at20["random_95"][1]  # above random's 95% interval
    assert b["hard_negatives_flagged"].startswith("0/")
