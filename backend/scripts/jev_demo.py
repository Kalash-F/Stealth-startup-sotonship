"""Demo set for the HS classifier: seven one-line invoices with known HS6 codes.

The PDFs never print an HS code, so the classifier has to infer it from the wording (brand names,
trade jargon, abbreviations). `run` posts every PDF to a running API with curl, saves each full
report, and prints it next to the expected HS6.

  python backend/scripts/jev_demo.py make                 # PDFs + answers.json in data/demo/jev/
  python backend/scripts/jev_demo.py run [--url URL]      # needs `make api` running
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

DEMO_DIR = ROOT / "data" / "demo" / "jev"
ANSWERS = DEMO_DIR / "answers.json"

# (description, quantity, unit, unit price USD, true HS6 or None, what it tests)
DEMO = [
    ("MBP 14 M3 16/512 SG", 40, "pcs", 1180.00, "847130", "brand abbreviation (MacBook Pro)"),
    ("HHB M10 x 50 8.8 ZP", 20000, "pcs", 0.32, "731815", "jargon (zinc-plated hex bolt)"),
    ("SanDisk Ultra Flair 64GB USB 3.0 flash drive", 1500, "pcs", 6.20, "852351", "brand name"),
    ("Arabica green coffee beans, Grade 2, 60kg jute bags", 320, "bags", 420.00, "090111",
     "plain wording"),
    ("Cu cathode Grade A, LME registered", 25, "MT", 9400.00, "740311",
     "chemical symbol (refined copper)"),
    ("Men's crew-neck tee, 100% combed cotton 180gsm", 5000, "pcs", 38.00, "610910",
     "planted ~3x over-price: PRICE_OUTLIER expected once classified"),
    ("Spare parts as per PO 4471", 1, "lot", 2500.00, None, "vague: should stay unclassified"),
]  # fmt: skip


def make() -> None:
    from tbml.schemas import AddressType, Invoice, LineItem, Party
    from tbml.synthetic.render import render_pdf

    seller = Party(
        name="Shenzhen Brightpath Trading Co., Ltd.",
        address="Room 1208, Block B, Tianan Cyber Park, Futian District, Shenzhen 518040, China",
        country="CN",
        address_type=AddressType.commercial,
    )
    buyer = Party(
        name="Harbourline Distribution UK Ltd",
        address="Unit 7, Kingsway Business Park, Manchester M19 1BB, United Kingdom",
        country="GB",
        address_type=AddressType.commercial,
    )
    DEMO_DIR.mkdir(parents=True, exist_ok=True)
    answers = []
    for i, (desc, qty, unit, price, hs6, note) in enumerate(DEMO, 1):
        invoice_id = f"JEV-DEMO-{i:02d}"
        line = LineItem(
            line_id="L1",
            description=desc,
            quantity=qty,
            unit=unit,
            unit_price=price,
            line_total=round(qty * price, 2),
            extraction_confidence=1.0,
        )
        invoice = Invoice(
            invoice_id=invoice_id,
            invoice_date=dt.date(2026, 10, 1),
            seller=seller,
            buyer=buyer,
            consignee=None,
            country_of_origin="P.R. China",
            port_of_loading="Shenzhen (Yantian), China",
            port_of_discharge="Felixstowe, United Kingdom",
            incoterm="FOB",
            currency="USD",
            line_items=[line],
            stated_total=line.line_total,
            source_file=f"{invoice_id}.pdf",
            is_synthetic=True,
        )
        render_pdf(invoice, "trade", DEMO_DIR / f"{invoice_id}.pdf")
        answers.append(
            {"invoice_id": invoice_id, "description": desc, "expected_hs6": hs6, "tests": note}
        )
    ANSWERS.write_text(json.dumps(answers, indent=2) + "\n")
    print(f"wrote {len(answers)} PDFs and answers.json to {DEMO_DIR.relative_to(ROOT)}/")


def _post(url: str, pdf: Path) -> dict:
    """The same request as `curl -X POST <url>/check -F file=@<pdf>`."""
    cmd = ["curl", "-sS", "-X", "POST", f"{url}/check", "-F", f"file=@{pdf}"]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if out.returncode != 0:
        raise SystemExit(f"curl failed ({out.stderr.strip()}). Is the API running? (make api)")
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        raise SystemExit(f"not a report from {url}/check: {out.stdout[:200]}") from None


def _money(x: float | None) -> str:
    return "n/a" if x is None else f"{x:,.2f}"


def run(url: str) -> None:
    if not ANSWERS.exists():
        raise SystemExit("no demo set yet: run `python backend/scripts/jev_demo.py make` first")
    answers = json.loads(ANSWERS.read_text())
    reports_dir = DEMO_DIR / "reports"
    reports_dir.mkdir(exist_ok=True)

    health = subprocess.run(["curl", "-sS", f"{url}/health"], capture_output=True, text=True)
    try:
        h = json.loads(health.stdout)
        print(f"API {url}: classifier {h.get('classifier', '?')}, chat model {h.get('llm', '?')}")
    except json.JSONDecodeError:
        raise SystemExit(f"API not reachable at {url} (start it with `make api`)") from None

    rows = []
    for a in answers:
        pdf = DEMO_DIR / f"{a['invoice_id']}.pdf"
        report = _post(url, pdf)
        if "lines" not in report:
            raise SystemExit(f"{a['invoice_id']}: API error: {report}")
        (reports_dir / f"{a['invoice_id']}.json").write_text(json.dumps(report, indent=2) + "\n")
        line = report["lines"][0] if report["lines"] else {}
        expected, got = a["expected_hs6"], line.get("hs6")
        ok = got == expected
        rows.append((a["invoice_id"], a["description"], expected, got, ok))

        print(f"\n=== {a['invoice_id']}  {a['description']}")
        print(f"tests:      {a['tests']}")
        confidence = line.get("classification_confidence", 0)
        print(
            f"HS6:        expected {expected or 'none (unclassified)'}, got {got or 'none'}  "
            f"{'OK' if ok else 'WRONG'}   (confidence {confidence:.2f})"
        )
        cands = ", ".join(f"{c['hs6']} {c['score']:.2f}" for c in line.get("hs6_candidates", []))
        print(f"candidates: {cands or '-'}")
        print(f"note:       {line.get('normalisation_note', '')}")
        b = line.get("benchmark")
        if b:
            print(
                f"price:      {_money(line.get('unit_price_usd'))} USD/{b['unit']} vs band "
                f"{_money(b['p10'])}-{_money(b['p90'])} (median {_money(b['median'])}, "
                f"route {b['route'] or 'global'})"
            )
        print(f"priority:   {report['priority_band']} ({report['priority_score']:.0f})")
        print(f"summary:    {report.get('summary') or '-'}")
        for f in report["flags"]:
            print(f"flag:       {f['rule']} ({f['severity']}): {f['reason']}")
        for w in report["warnings"]:
            print(f"warning:    {w}")

    goods = [r for r in rows if r[2]]
    print("\n=== Summary")
    print(f"{'invoice':<13} {'expected':<9} {'got':<9} result  description")
    for inv, desc, exp, got, ok in rows:
        result = "OK" if ok else "WRONG"
        print(f"{inv:<13} {exp or 'none':<9} {got or 'none':<9} {result:<7} {desc}")
    print(
        f"\nGoods classified correctly: {sum(r[4] for r in goods)}/{len(goods)}; "
        f"vague lines left unclassified: {sum(r[4] for r in rows if not r[2])}/"
        f"{sum(1 for r in rows if not r[2])}. Full reports: {reports_dir.relative_to(ROOT)}/"
    )


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("make", help="render the seven demo PDFs and answers.json")
    r = sub.add_parser("run", help="post every demo PDF to the API and compare")
    r.add_argument("--url", default="http://localhost:8000")
    args = p.parse_args()
    if args.cmd == "make":
        make()
    else:
        run(args.url)


if __name__ == "__main__":
    main()
