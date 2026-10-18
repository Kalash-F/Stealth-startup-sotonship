"""Evaluation (plan.md Phase 6): the numbers for the pitch, reproducible from the repo.

Part A, classification: data/eval/descriptions.csv holds realistic invoice wording (jargon, brand
names, near-miss goods, vague filler) with the correct HS6. Each method classifies every line:
  keyword       offline baseline (keyword lists in hs6.csv)
  flat          one LLM call straight to HS6
  hierarchical  three LLM calls: chapter -> heading -> HS6, each from the real HS list
  jev           Jev (decision model) picks chapter -> heading -> HS6, beam search K=3; the chat
                model, when configured, only reads the line first (see tbml/classify/jev.py)
Scored on: exact HS6 accuracy on real goods, vague lines correctly left unclassified, and
"confidently wrong" answers (a code given that is not the right one: the costly mistake).
LLM methods use the configured provider (tbml/llm.py) and its caches; if the provider cannot be
reached, only cached answers are used and the report says so.

Part B, detection: runs the full pipeline from the PDF on every synthetic invoice and reports
invoice-level precision/recall/F1, recall per planted anomaly type, false positives on the hard
negatives, and the review-budget comparison: if an officer reviews only the top 10/20/30% of
invoices by priority score, what share of the anomalous ones do they catch, against random
spot-checks of the same size (10,000 simulations, mean and 95% interval).

Run:  python backend/scripts/evaluate.py [--skip-a] [--skip-b] [--llm-pipeline]
Out:  reports/eval/summary.json and reports/eval/summary.md
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import random
import statistics
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from tbml import llm  # noqa: E402
from tbml.benchmark import describe_source  # noqa: E402
from tbml.classify import classify_description  # noqa: E402
from tbml.classify.hierarchical import HierarchicalProposer  # noqa: E402
from tbml.classify.jev import JevProposer  # noqa: E402
from tbml.classify.placeholder import is_placeholder  # noqa: E402
from tbml.classify.proposers import CachedProposer, KeywordProposer, LLMProposer  # noqa: E402
from tbml.paths import SYNTHETIC_DIR  # noqa: E402

EVAL_CSV = ROOT / "data" / "eval" / "descriptions.csv"
OUT_DIR = ROOT / "reports" / "eval"
BUDGETS = (0.10, 0.20, 0.30)
SIMULATIONS = 10_000

# planted label -> the rule that should fire for it
LABEL_RULE = {
    "OVER_PRICE": "PRICE_OUTLIER",
    "UNDER_PRICE": "PRICE_OUTLIER",
    "QTY_VALUE_IMPLAUSIBLE": "QTY_VALUE_IMPLAUSIBLE",
    "PLACEHOLDER_DESC": "PLACEHOLDER_DESC",
    "GEO_INCONSISTENT": "GEO_INCONSISTENT",
    "ROUTE_NO_ECONOMIC_SENSE": "ROUTE_NO_ECONOMIC_SENSE",
    "ARITHMETIC_ERROR": "ARITHMETIC_ERROR",
    "RESIDENTIAL_CONSIGNEE": "RESIDENTIAL_CONSIGNEE",
}


# ---- Part A: classification -------------------------------------------------------------------


class _CacheOnly:
    """Stands in for an unreachable provider: every live call fails at once, so only cached
    answers come back (instead of each line waiting through network retries)."""

    def __init__(self, real):
        self.model, self.provider = real.model, real.provider
        self.messages = llm._MessagesShim(self)

    def complete(self, *args, **kwargs):
        raise llm.LLMError("provider unreachable from this machine (cache only)")


def _llm_client():
    """(client, live?, note). Probes the provider once with no retries."""
    client = llm.configured_client()
    if client is None:
        return None, False, "no LLM provider configured"
    try:
        probe = (
            llm.OpenRouterClient(client.model, client._key, retries=0)
            if client.provider == "openrouter"
            else client
        )
        probe.complete(
            "Reply with the word ok.", [{"role": "user", "content": "ok?"}], max_tokens=5
        )
        return client, True, f"live: {client.provider}:{client.model}"
    except (llm.LLMError, Exception) as exc:  # noqa: BLE001 - any failure means "not live"
        return (
            _CacheOnly(client),
            False,
            f"{client.provider}:{client.model} unreachable ({str(exc)[:120]}); cached answers only",
        )


def part_a() -> dict:
    rows = list(csv.DictReader(open(EVAL_CSV, newline="")))
    client, live, note = _llm_client()
    methods = {"keyword": KeywordProposer()}
    if client is not None:
        tag = f"{client.provider}:{client.model}"
        methods["flat"] = CachedProposer(LLMProposer(client=client), model=tag)
        methods["hierarchical"] = HierarchicalProposer(client=client)
    jev = llm.jev_client()
    if jev is not None:  # Jev needs only the OpenRouter key; the chat model is optional
        methods["jev"] = JevProposer(jev=jev, chat=client)

    results = {}
    for name, proposer in methods.items():
        per_kind = defaultdict(lambda: [0, 0])
        goods_ok = goods_n = vague_ok = vague_n = wrong_confident = unavailable = 0
        lines = []
        workers = (
            1 if name == "keyword" else 8
        )  # LLM calls are network-bound: run lines in parallel
        with ThreadPoolExecutor(workers) as pool:
            results_for = list(
                pool.map(lambda r, p=proposer: classify_description(r["description"], p), rows)
            )
        for r, cls in zip(rows, results_for, strict=True):
            truth = r["true_hs6"] or None
            if "classifier unavailable" in cls.reason:
                unavailable += 1
            if truth:
                goods_n += 1
                ok = cls.hs6 == truth
                goods_ok += ok
                per_kind[r["kind"]][0] += ok
                per_kind[r["kind"]][1] += 1
                wrong_confident += cls.hs6 is not None and cls.hs6 != truth
            else:
                vague_n += 1
                vague_ok += cls.hs6 is None
                wrong_confident += cls.hs6 is not None
            lines.append(
                {
                    "description": r["description"],
                    "truth": truth,
                    "got": cls.hs6,
                    "confidence": round(cls.confidence, 3),
                    "path": cls.path,
                    "reason": cls.reason,
                }
            )
        reached = sum(not is_placeholder(r["description"]) for r in rows)  # lines the method sees
        ran = unavailable < reached
        results[name] = {
            "ran": ran,
            "unavailable_lines": unavailable,
            "goods_accuracy": goods_ok / goods_n if goods_n else None,
            "goods_correct": goods_ok,
            "goods_total": goods_n,
            "vague_left_unclassified": vague_ok,
            "vague_total": vague_n,
            "confidently_wrong": wrong_confident,
            "accuracy_by_kind": {k: f"{v[0]}/{v[1]}" for k, v in sorted(per_kind.items())},
            "lines": lines,
            **(
                {"model": proposer.jev.model, "cost_usd": round(proposer.jev.spent_usd, 6)}
                if isinstance(proposer, JevProposer)
                else {}
            ),
        }
    return {"provider": note, "live": live, "n_lines": len(rows), "methods": results}


# ---- Part B: detection ------------------------------------------------------------------------


def part_b(use_llm: bool) -> dict:
    if not use_llm:  # the rules and the offline classifier only; no network, repeatable
        for var in ("OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"):
            os.environ.pop(var, None)
        os.environ["TBML_NO_DOTENV"] = "1"
    from tbml.pipeline import check

    invoices = {r["invoice_id"]: r for r in csv.DictReader(open(SYNTHETIC_DIR / "invoices.csv"))}
    labels = list(csv.DictReader(open(SYNTHETIC_DIR / "labels.csv")))

    reports, timings = {}, []
    for inv_id in sorted(invoices):
        t0 = time.perf_counter()
        reports[inv_id] = check(SYNTHETIC_DIR / "pdfs" / f"{inv_id}.pdf")
        timings.append(time.perf_counter() - t0)

    truth = {i: r["role"] == "anomalous" for i, r in invoices.items()}
    flagged = {i: rep.priority_band != "low" for i, rep in reports.items()}
    tp = sum(truth[i] and flagged[i] for i in truth)
    fp = sum(not truth[i] and flagged[i] for i in truth)
    fn = sum(truth[i] and not flagged[i] for i in truth)
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0

    per_type: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for row in labels:
        if not row["label"]:
            continue
        fired = {str(getattr(f.rule, "value", f.rule)) for f in reports[row["invoice_id"]].flags}
        per_type[row["label"]][1] += 1
        per_type[row["label"]][0] += LABEL_RULE[row["label"]] in fired

    hard = [i for i, r in invoices.items() if r["role"] == "hard_negative"]
    clean = [i for i, r in invoices.items() if r["role"] == "clean"]

    # review budget: top-k by score (ties broken by id, so it is deterministic)
    ranked = sorted(reports, key=lambda i: (-reports[i].priority_score, i))
    n, n_anom = len(ranked), sum(truth.values())
    rng = random.Random(42)
    ids = list(reports)
    budgets = []
    for b in BUDGETS:
        k = max(1, round(b * n))
        ours = sum(truth[i] for i in ranked[:k]) / n_anom
        sims = sorted(
            sum(truth[i] for i in rng.sample(ids, k)) / n_anom for _ in range(SIMULATIONS)
        )
        budgets.append(
            {
                "budget": b,
                "invoices_reviewed": k,
                "ours_caught": ours,
                "random_mean": statistics.fmean(sims),
                "random_95": [sims[int(0.025 * SIMULATIONS)], sims[int(0.975 * SIMULATIONS) - 1]],
            }
        )

    any_mock = any(
        line.benchmark is not None and line.benchmark.is_mock
        for rep in reports.values()
        for line in rep.lines
    )
    return {
        "classifier": "LLM (configured provider)" if use_llm else "offline keyword baseline",
        "benchmarks_mock": any_mock,
        "price_data": describe_source(),
        "n_invoices": n,
        "n_anomalous": n_anom,
        "invoice_level": {
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "tp": tp,
            "fp": fp,
            "fn": fn,
        },
        "per_type_recall": {k: f"{v[0]}/{v[1]}" for k, v in sorted(per_type.items())},
        "hard_negatives_flagged": f"{sum(flagged[i] for i in hard)}/{len(hard)}",
        "clean_flagged": f"{sum(flagged[i] for i in clean)}/{len(clean)}",
        "review_budget": budgets,
        "median_seconds_per_invoice": statistics.median(timings),
    }


# ---- output -------------------------------------------------------------------------------------


def _pct(x):
    return "n/a" if x is None else f"{100 * x:.0f}%"


def to_markdown(a: dict | None, b: dict | None) -> str:
    out = [
        "# Evaluation summary",
        "",
        "Generated by `backend/scripts/evaluate.py`. All invoices are synthetic.",
        "",
    ]
    if a:
        out += [
            "## A. Classification on realistic invoice wording",
            "",
            f"{a['n_lines']} descriptions in `data/eval/descriptions.csv`. LLM: {a['provider']}.",
            "",
            "| Method | Correct HS6 (real goods) | Vague lines left unclassified | Confidently wrong |",
            "|---|---|---|---|",
        ]
        for name, m in a["methods"].items():
            if not m["ran"]:
                out.append(f"| {name} | not run (no provider, no cache) | | |")
                continue
            note = (
                f" ({m['unavailable_lines']} lines had no answer)" if m["unavailable_lines"] else ""
            )
            out.append(
                f"| {name} | {m['goods_correct']}/{m['goods_total']} ({_pct(m['goods_accuracy'])}){note} "
                f"| {m['vague_left_unclassified']}/{m['vague_total']} | {m['confidently_wrong']} |"
            )
        jev = a["methods"].get("jev")
        if jev and jev["ran"]:
            out += ["", f"jev: {jev['model']}, ${jev['cost_usd']:.6f} on uncached calls this run."]
        out += [
            "",
            "Accuracy by kind of wording:",
            "",
            "| Method | "
            + " | ".join(next(iter(a["methods"].values()))["accuracy_by_kind"])
            + " |",
        ]
        out.append("|---" * (1 + len(next(iter(a["methods"].values()))["accuracy_by_kind"])) + "|")
        for name, m in a["methods"].items():
            if m["ran"]:
                out.append(f"| {name} | " + " | ".join(m["accuracy_by_kind"].values()) + " |")
        out.append("")
    if b:
        ib = b["invoice_level"]
        out += [
            "## B. Detection on the 60 synthetic invoices (full pipeline from PDF)",
            "",
            f"Classifier: {b['classifier']}. Price benchmarks: {'MOCK (not real trade data)' if b['benchmarks_mock'] else 'real'} ({b.get('price_data', 'bands.json')}).",
            "",
            f"- Invoice level (flagged = review or review_now): precision {_pct(ib['precision'])}, recall {_pct(ib['recall'])}, F1 {ib['f1']:.2f} "
            f"({ib['tp']} caught, {ib['fp']} false alarms, {ib['fn']} missed, of {b['n_anomalous']} anomalous).",
            f"- Hard negatives (legitimate but suspicious-looking) flagged: {b['hard_negatives_flagged']}; plain clean invoices flagged: {b['clean_flagged']}.",
            f"- Median time per invoice: {b['median_seconds_per_invoice']:.2f} s.",
            "",
            "| Review budget | Invoices reviewed | Anomalies caught (ours) | Random spot-checks (mean, 95% interval) |",
            "|---|---|---|---|",
        ]
        for r in b["review_budget"]:
            lo, hi = r["random_95"]
            out.append(
                f"| {_pct(r['budget'])} | {r['invoices_reviewed']} | {_pct(r['ours_caught'])} | {_pct(r['random_mean'])} ({_pct(lo)} to {_pct(hi)}) |"
            )
        out += ["", "Recall per planted anomaly type:", "", "| Anomaly | Caught |", "|---|---|"]
        out += [f"| {k} | {v} |" for k, v in b["per_type_recall"].items()]
        out += [
            "",
            "Caveats: the invoices are synthetic and the anomalies were planted by our own generator, so these "
            "numbers show the rules work as designed, not real-world performance."
            + (
                " Mock benchmarks are approximate."
                if b["benchmarks_mock"]
                else " Prices compared against HMRC Overseas Trade Statistics, UK imports"
                + (
                    " July 2023 to August 2026 (benchmark databases, p1-p99 per year)."
                    if str(b.get("price_data", "")).startswith("database")
                    else " 2023-2025."
                )
            ),
        ]
    return "\n".join(out) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--skip-a", action="store_true", help="skip the classification comparison")
    ap.add_argument("--skip-b", action="store_true", help="skip the pipeline detection run")
    ap.add_argument(
        "--llm-pipeline", action="store_true", help="use the LLM inside the pipeline run too"
    )
    ap.add_argument("--model", help="override OPENROUTER_MODEL, e.g. google/gemini-2.5-flash")
    ap.add_argument("--out", type=Path, default=OUT_DIR, help="output directory")
    args = ap.parse_args()
    if args.model:
        llm.load_dotenv()
        os.environ["OPENROUTER_MODEL"] = args.model

    a = None if args.skip_a else part_a()
    b = None if args.skip_b else part_b(args.llm_pipeline)
    out_dir = args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "summary.json").write_text(
        json.dumps({"classification": a, "detection": b}, indent=2, default=str) + "\n"
    )
    md = to_markdown(a, b)
    (out_dir / "summary.md").write_text(md)
    print(md)


if __name__ == "__main__":
    main()
