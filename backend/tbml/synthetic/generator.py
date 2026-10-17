"""Synthetic, labelled invoice generator (plan.md Phase 1).

Same seed -> byte-identical truth JSON, labels.csv, lines.csv and invoices.csv. Every random
choice goes through one `random.Random(seed)`, consumed in a fixed order.

Outputs under `out_dir`:
- `pdfs/{invoice_id}.pdf`     rendered invoice (text-based PDF)
- `truth/{invoice_id}.json`   the full `Invoice` the PDF was rendered from
- `labels.csv`                one row per planted anomaly, plus one row per hard negative
- `lines.csv`                 per-line ground truth the `Invoice` contract can't hold (true HS6,
                              price in USD per benchmark unit) for classification and
                              normalisation tests
- `invoices.csv`              one row per invoice: role, template, route, labels
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path

from tbml.paths import REFERENCE_DIR
from tbml.schemas import AddressType, Benchmark, Invoice, LineItem, Party
from tbml.synthetic import catalogue as cat

ANOMALY_TYPES = (
    "OVER_PRICE",
    "UNDER_PRICE",
    "QTY_VALUE_IMPLAUSIBLE",
    "PLACEHOLDER_DESC",
    "GEO_INCONSISTENT",
    "ROUTE_NO_ECONOMIC_SENSE",
    "ARITHMETIC_ERROR",
    "RESIDENTIAL_CONSIGNEE",
)
LINE_LEVEL = {
    "OVER_PRICE",
    "UNDER_PRICE",
    "QTY_VALUE_IMPLAUSIBLE",
    "PLACEHOLDER_DESC",
    "ROUTE_NO_ECONOMIC_SENSE",
}
HARD_KINDS = ("premium_near_p90", "bulk_discount_near_p10", "unusual_route_explained")
TEMPLATES = ("classic", "modern", "trade")

ANOMALOUS_SHARE = 0.30
HARD_NEGATIVE_SHARE = 0.10
# ARITHMETIC_ERROR must exceed the R6 tolerance (0.5% or 1 currency unit) by a clear margin.
ARITH_MIN_REL = 0.03
ARITH_MIN_ABS = 10.0
RESIDENTIAL_MIN_TOTAL_USD = 30_000.0
QTY_VALUE_MIN_P90_MULTIPLE = 15.0

DEFAULT_BANDS = REFERENCE_DIR / "placeholder_bands.json"
DEFAULT_FX = REFERENCE_DIR / "fx.csv"


# --- inputs -------------------------------------------------------------------------------
def load_bands(path: Path = DEFAULT_BANDS) -> dict[str, Benchmark]:
    """Global (route = null) band per HS6, from a JSON list of `Benchmark`s (`placeholder_bands.json`
    or a `bands*.json` written by `fetch_benchmarks.py`)."""
    path = Path(path)
    rows = json.loads(path.read_text())
    bands = {}
    for row in rows:
        b = Benchmark.model_validate(row)
        if b.route is None:
            bands[b.hs6] = b
    missing = set(cat.COMMODITIES) - set(bands)
    if missing:
        raise ValueError(f"no global band for {sorted(missing)} in {path}")
    return bands


def load_fx(path: Path = DEFAULT_FX) -> dict[str, float]:
    """Currency -> units per 1 USD from the reference fx.csv."""
    with open(path, newline="") as f:
        return {r["currency"]: float(r["units_per_usd"]) for r in csv.DictReader(f)}


# --- working types ------------------------------------------------------------------------
@dataclass
class Line:
    """A generated line in generator terms: the intended USD price per benchmark unit, the
    printed (invoice-currency) price and total, and the HS6 a classifier should return."""

    hs6: str
    variant: cat.Variant
    description: str
    quantity: float
    usd_per_bench: float  # intended price in USD per benchmark unit
    unit_price: float = 0.0  # printed, invoice currency
    line_total: float = 0.0  # printed, invoice currency
    label: str = ""
    expected_hs6: str | None = None  # what a classifier should return (None for placeholders)


@dataclass
class Generated:
    """One synthetic invoice with its ground truth: the Invoice, template, role, planted
    anomalies as (label, line_id or None, detail), hard-negative kind and per-line truth."""

    invoice: Invoice
    template: str
    role: str  # clean | anomalous | hard_negative
    # (label, line_id or None for invoice-level, detail)
    anomalies: list[tuple[str, str | None, str]] = field(default_factory=list)
    hard_kind: str = ""
    lines: list[Line] = field(default_factory=list)
    fx_rate: float = 1.0


# --- helpers ------------------------------------------------------------------------------
def _log_uniform(rng: random.Random, lo: float, hi: float) -> float:
    """Sample between lo and hi uniformly on a log scale (prices span orders of magnitude)."""
    return math.exp(rng.uniform(math.log(lo), math.log(hi)))


def _log_interp(lo: float, hi: float, t: float) -> float:
    """Point a fraction t of the way from lo to hi on a log scale."""
    return math.exp(math.log(lo) + t * (math.log(hi) - math.log(lo)))


def _round_price(x: float) -> float:
    """Printed precision; must match `render.fmt_price`."""
    return round(x, 2) if x >= 10 else round(x, 4) if x >= 0.01 else round(x, 6)


def _nice_qty(rng: random.Random, variant: cat.Variant, lo: float, hi: float) -> float:
    """Random quantity rounded to a round number (10s, 50s, 500s by size), as real orders are."""
    if variant.qty_decimals:
        return round(rng.uniform(lo, hi), variant.qty_decimals)
    q = rng.randint(int(lo), int(hi))
    step = 500 if q >= 10_000 else 50 if q >= 1_000 else 10 if q >= 100 else 1
    return float(max(step, round(q / step) * step))


def _schedule(rng: random.Random, n: int) -> list[tuple[str, list[str], str]]:
    """Role, anomaly list and hard-negative kind for each invoice index."""
    n_anom = round(ANOMALOUS_SHARE * n)
    n_hard = round(HARD_NEGATIVE_SHARE * n)
    if n_anom + n_hard > n:
        raise ValueError(f"n={n} too small")
    # Each anomaly type at least 4 times when there is room for ≤2 anomalies per invoice.
    per_type = max(1, math.ceil(1.6 * n_anom / len(ANOMALY_TYPES)))
    slots = [t for t in ANOMALY_TYPES for _ in range(per_type)]
    rng.shuffle(slots)  # random pairings, so no two anomaly types always travel together
    buckets: list[list[str]] = [[] for _ in range(n_anom)]
    for t in slots:
        free = [b for b in buckets if t not in b] or buckets
        min(free, key=len).append(t)
    roles = (
        [("anomalous", b, "") for b in buckets]
        + [("hard_negative", [], HARD_KINDS[i % len(HARD_KINDS)]) for i in range(n_hard)]
        + [("clean", [], "")] * (n - n_anom - n_hard)
    )
    rng.shuffle(roles)
    return roles


class _Factory:
    """Builds fictional parties, addresses and lines, drawing every choice from one seeded RNG."""

    def __init__(self, rng: random.Random, bands: dict[str, Benchmark], fx: dict[str, float]):
        self.rng = rng
        self.bands = bands
        self.fx = fx

    # parties ------------------------------------------------------------------------------
    def company(self, cc: str) -> str:
        """Invented company name with a legal suffix valid for the country."""
        r = self.rng
        stem, trade = r.choice(cat.NAME_STEMS), r.choice(cat.NAME_TRADES)
        return f"{stem} {trade} {r.choice(cat.COMPANY_SUFFIX[cc])}"

    def commercial_address(self, cc: str) -> tuple[str, AddressType]:
        """Country-style business address and its true type (UAE P.O. boxes are `unknown`)."""
        r = self.rng
        city = r.choice(cat.CITIES[cc])
        if cc == "GB":
            pc = f"{cat.GB_POSTCODE_AREA[city]}{r.randint(90, 99)} {r.randint(1, 9)}ZX"
            kind = r.choice(["Industrial Estate", "Business Park", "Trading Estate"])
            return (
                f"Unit {r.randint(1, 40)}, {r.choice(cat.STREET_NAMES)} {kind}, {city} {pc}, "
                "United Kingdom",
                AddressType.commercial,
            )
        if cc == "CN":
            return (
                f"No. {r.randint(8, 988)} {r.choice(cat.CN_STREETS)} Industrial Park Road, "
                f"{cat.CN_DISTRICTS[city]}, {city} {r.randint(200000, 529999)}, China",
                AddressType.commercial,
            )
        if cc == "AE":
            roll = r.random()
            if roll < 0.15:
                return f"P.O. Box {r.randint(10000, 99999)}, {city}, United Arab Emirates", (
                    AddressType.unknown
                )
            if roll < 0.6:
                return (
                    f"Warehouse {r.randint(1, 80)}, Plot S{r.randint(10_000, 99_999)}, "
                    "Jebel Ali Free Zone, Dubai, United Arab Emirates",
                    AddressType.commercial,
                )
            return (
                f"Office {r.randint(101, 1450)}, {r.choice(cat.STREET_NAMES)} Business Centre, "
                f"{r.choice(cat.AE_AREAS)}, {city}, United Arab Emirates",
                AddressType.commercial,
            )
        return (
            f"Areál {r.choice(cat.STREET_NAMES)}, {r.choice(cat.CZ_STREETS)} {r.randint(1, 120)}, "
            f"{r.randint(600, 799)} {r.randint(10, 99)} {city}, Czech Republic",
            AddressType.commercial,
        )

    def residential_address(self, cc: str) -> str:
        """Country-style private-home address (flat, apartment, byt, room)."""
        r = self.rng
        city = r.choice(cat.CITIES[cc])
        if cc == "GB":
            return (
                f"Flat {r.randint(1, 24)}, {r.randint(2, 90)} {r.choice(cat.STREET_NAMES)} Court, "
                f"{city} {cat.GB_POSTCODE_AREA[city]}{r.randint(90, 99)} {r.randint(1, 9)}ZY, "
                "United Kingdom"
            )
        if cc == "AE":
            return (
                f"Apartment {r.randint(101, 2405)}, {r.choice(cat.AE_TOWERS)}, {city}, "
                "United Arab Emirates"
            )
        if cc == "CZ":
            return (
                f"Byt {r.randint(1, 30)}, {r.choice(cat.CZ_STREETS)} {r.randint(1, 120)}, "
                f"{r.randint(600, 799)} {r.randint(10, 99)} {city}, Czech Republic"
            )
        return (
            f"Room {r.randint(101, 2808)}, Building {r.randint(1, 30)}, "
            f"Lane {r.randint(1, 900)} {r.choice(cat.CN_STREETS)} Road, {city}, China"
        )

    def party(self, cc: str) -> Party:
        """A seller or buyer in country `cc` with a business address."""
        address, kind = self.commercial_address(cc)
        return Party(name=self.company(cc), address=address, country=cc, address_type=kind)

    # lines --------------------------------------------------------------------------------
    def line(self, hs6: str, big: bool = False) -> Line:
        """A clean line: random variant and quantity, price inside the band's p25-p75.
        `big` draws from the upper half of the quantity range."""
        commodity = cat.COMMODITIES[hs6]
        variant = self.rng.choice(commodity.variants)
        lo, hi = variant.qty_range
        if big:
            lo = (lo + hi) / 2
        qty = _nice_qty(self.rng, variant, lo, hi)
        b = self.bands[hs6]
        price = _log_uniform(self.rng, b.p25, b.p75)
        return Line(hs6, variant, variant.description, qty, price, expected_hs6=hs6)


def _generate_one(f: _Factory, idx: int, role: str, anomalies: list[str], hard_kind: str):
    """Build one invoice: pick route, template and currency, choose commodities for the planted
    anomalies, then apply each anomaly (or hard-negative pattern) and record its label."""
    r = f.rng
    template = r.choice(TEMPLATES)
    if hard_kind == "unusual_route_explained":
        route = r.choice(["GB-AE", "AE-CZ"])
    else:
        route = r.choice(cat.ROUTES)
    seller_cc, buyer_cc = route.split("-")
    currency = r.choice(cat.ROUTE_CURRENCIES[route])
    rate = f.fx[currency]
    date = dt.date(2024, 1, 1) + dt.timedelta(days=r.randint(0, 365))

    # --- commodity mix -------------------------------------------------------------------
    priced_anoms = [a for a in anomalies if a in LINE_LEVEL]
    if "ARITHMETIC_ERROR" in anomalies:
        arith_on_line = r.random() < 0.5
    else:
        arith_on_line = False
    n_needed = len(priced_anoms) + (1 if arith_on_line else 0)
    n_lines = max(n_needed, r.choice([1, 1, 2, 2, 3, 3, 4, 5]))
    non_parity = [h for h in cat.COMMODITIES if h not in cat.PARITY_HS6]
    filler_pool = [h for h in cat.COMMODITIES if h != "090111"]

    coffee_only = False
    if "ROUTE_NO_ECONOMIC_SENSE" in anomalies:
        route_hs6 = "740311" if len(priced_anoms) > 1 else r.choice(cat.PARITY_HS6)
        coffee_only = route_hs6 == "090111"
    elif role != "anomalous" and hard_kind != "premium_near_p90" and r.random() < 0.12:
        coffee_only = True

    big = "RESIDENTIAL_CONSIGNEE" in anomalies
    lines: list[Line] = []
    for slot in range(n_lines):
        if coffee_only:
            hs6 = "090111"
        elif slot < len(priced_anoms) and priced_anoms[slot] == "ROUTE_NO_ECONOMIC_SENSE":
            hs6 = "740311"
        elif slot < len(priced_anoms) and priced_anoms[slot] != "PLACEHOLDER_DESC":
            hs6 = r.choice(non_parity)
        elif hard_kind in ("premium_near_p90", "bulk_discount_near_p10") and slot == 0:
            hs6 = r.choice(non_parity)
        else:
            hs6 = r.choice(filler_pool)
        lines.append(f.line(hs6, big=big))

    # --- origin, ports, parties ----------------------------------------------------------
    origin = r.choice(cat.COUNTRY_NAMES[seller_cc])
    if coffee_only:
        grower = r.choice(["Brazil", "Colombia", "Ethiopia", "Vietnam"])
        origin = (
            f"{grower} (re-exported from {cat.COUNTRY_LABEL[seller_cc]}; "
            "certificate of origin attached)"
        )
    elif seller_cc == "AE" and r.random() < 0.5:
        origin = f"{r.choice(['China', 'India'])} (re-exported from Jebel Ali Free Zone, Dubai)"
    port_loading = r.choice(cat.PORTS_OF_LOADING[seller_cc])
    port_discharge = r.choice(cat.PORTS_OF_DISCHARGE[buyer_cc])
    incoterm = r.choice(cat.INCOTERMS)
    seller = f.party(seller_cc)
    buyer = f.party(buyer_cc)
    consignee = f.party(buyer_cc) if r.random() < 0.3 else None

    labels: list[tuple[str, str | None, str]] = []

    # --- line-level anomalies (one per line, in slot order) ------------------------------
    for slot, label in enumerate(priced_anoms):
        ln = lines[slot]
        ln.label = label
        b = f.bands[ln.hs6]
        lid = f"L{slot + 1}"
        if label == "OVER_PRICE":
            factor = _log_uniform(r, 3, 1000)
            ln.usd_per_bench = b.median * factor
            labels.append((label, lid, f"unit price x{factor:.1f} the median"))
        elif label == "UNDER_PRICE":
            factor = _log_uniform(r, 3, 100)
            ln.usd_per_bench = b.median / factor
            labels.append((label, lid, f"unit price 1/{factor:.1f} of the median"))
        elif label == "QTY_VALUE_IMPLAUSIBLE":
            v = ln.variant
            ln.quantity = float(r.randint(1, 20))
            target_usd = _log_uniform(r, 150_000, 2_000_000)
            per_bench = target_usd / (ln.quantity * v.bench_per_unit)
            ln.usd_per_bench = max(per_bench, QTY_VALUE_MIN_P90_MULTIPLE * b.p90 * 1.05)
            labels.append((label, lid, f"{ln.quantity:g} {v.unit} for ~USD {target_usd:,.0f}"))
        elif label == "PLACEHOLDER_DESC":
            ln.description = r.choice(cat.PLACEHOLDER_DESCRIPTIONS)
            ln.expected_hs6 = None
            labels.append((label, lid, f"description '{ln.description}' hides {ln.hs6}"))
        elif label == "ROUTE_NO_ECONOMIC_SENSE":
            ln.usd_per_bench = _log_interp(b.p75, b.p90, r.uniform(0.3, 0.9))
            labels.append(
                (label, lid, f"{cat.COMMODITIES[ln.hs6].name} {route} priced between p75 and p90")
            )

    # --- hard negatives ------------------------------------------------------------------
    if hard_kind == "premium_near_p90":
        ln = lines[0]
        b = f.bands[ln.hs6]
        ln.usd_per_bench = _log_interp(b.p75, b.p90, r.uniform(0.75, 0.95))
        ln.description = f"{r.choice(['Premium', 'Enterprise-grade', 'Branded'])} {ln.description}"
    elif hard_kind == "bulk_discount_near_p10":
        ln = lines[0]
        b = f.bands[ln.hs6]
        ln.usd_per_bench = _log_interp(b.p10, b.p25, r.uniform(0.05, 0.4))
        ln.quantity = _nice_qty(
            r, ln.variant, ln.variant.qty_range[1] * 1.5, ln.variant.qty_range[1] * 3
        )
        ln.description = f"{ln.description} (bulk order, volume discount applied)"
    elif hard_kind == "unusual_route_explained":
        third = r.choice(cat.OTHER_ORIGINS)
        if seller_cc == "GB":
            how = "transhipped through Felixstowe"
        else:
            how = "re-exported from Jebel Ali Free Zone, Dubai"
        origin = f"{third} ({how}; certificate of origin attached)"

    # --- invoice-level anomalies ---------------------------------------------------------
    if "GEO_INCONSISTENT" in anomalies:
        if r.random() < 0.5:
            other = r.choice([c for c in cat.CITIES if c != seller_cc])
            city = r.choice(cat.CITIES[other])
            origin = f"{city}, {cat.COUNTRY_LABEL[seller_cc]}"
            labels.append(("GEO_INCONSISTENT", None, f"origin city {city} is not in {seller_cc}"))
        else:
            origin = r.choice(cat.OTHER_ORIGINS)
            detail = f"origin {origin} vs loading port in {seller_cc}, no explanation"
            labels.append(("GEO_INCONSISTENT", None, detail))
    if "RESIDENTIAL_CONSIGNEE" in anomalies:
        consignee = Party(
            name=r.choice(cat.PERSON_NAMES),
            address=f.residential_address(buyer_cc),
            country=buyer_cc,
            address_type=AddressType.residential,
        )
        labels.append(("RESIDENTIAL_CONSIGNEE", None, "consignee is a private residence"))

    # --- prices and totals ---------------------------------------------------------------
    def price_lines() -> float:
        """Convert intended USD prices to printed prices and totals; returns the USD total."""
        for ln in lines:
            ln.unit_price = _round_price(ln.usd_per_bench * ln.variant.bench_per_unit * rate)
            ln.line_total = round(ln.quantity * ln.unit_price, 2)
        return sum(ln.line_total for ln in lines) / rate

    total_usd = price_lines()
    if "RESIDENTIAL_CONSIGNEE" in anomalies:
        while total_usd < RESIDENTIAL_MIN_TOTAL_USD:
            for ln in lines:
                if ln.label != "QTY_VALUE_IMPLAUSIBLE":
                    ln.quantity = ln.quantity * 2
            total_usd = price_lines()

    stated_total = round(sum(ln.line_total for ln in lines), 2)
    if "ARITHMETIC_ERROR" in anomalies:
        sign = r.choice([-1, 1])
        if arith_on_line:
            slot = len(priced_anoms)
            ln = lines[slot]
            ln.label = "ARITHMETIC_ERROR"
            correct = ln.line_total
            delta = max(r.uniform(ARITH_MIN_REL, 0.4) * correct, ARITH_MIN_ABS)
            ln.line_total = round(correct + sign * delta, 2)
            stated_total = round(sum(x.line_total for x in lines), 2)
            labels.append(
                ("ARITHMETIC_ERROR", f"L{slot + 1}", f"line total {ln.line_total} != {correct}")
            )
        else:
            correct = stated_total
            delta = max(r.uniform(ARITH_MIN_REL, 0.25) * correct, ARITH_MIN_ABS)
            stated_total = round(correct + sign * delta, 2)
            labels.append(("ARITHMETIC_ERROR", None, f"stated total {stated_total} != {correct}"))

    year = date.year % 100
    invoice_id = {
        "classic": f"INV-{date.year}-{idx:04d}",
        "modern": f"PI-{idx:04d}-{year}",
        "trade": f"TX{year}{idx:04d}",
    }[template]

    invoice = Invoice(
        invoice_id=invoice_id,
        invoice_date=date,
        seller=seller,
        buyer=buyer,
        consignee=consignee,
        country_of_origin=origin,
        port_of_loading=port_loading,
        port_of_discharge=port_discharge,
        incoterm=incoterm,
        currency=currency,
        line_items=[
            LineItem(
                line_id=f"L{i + 1}",
                description=ln.description,
                quantity=ln.quantity,
                unit=ln.variant.unit,
                unit_price=ln.unit_price,
                line_total=ln.line_total,
                extraction_confidence=1.0,
            )
            for i, ln in enumerate(lines)
        ],
        stated_total=stated_total,
        source_file=f"{invoice_id}.pdf",
        is_synthetic=True,
    )
    return Generated(invoice, template, role, labels, hard_kind, lines, rate)


def generate(
    seed: int, n: int, bands: dict[str, Benchmark] | None = None, fx: dict[str, float] | None = None
) -> list[Generated]:
    """Generate `n` invoices deterministically from `seed` (about 30% anomalous, 10% hard
    negatives)."""
    rng = random.Random(seed)
    factory = _Factory(rng, bands or load_bands(), fx or load_fx())
    schedule = _schedule(rng, n)
    return [
        _generate_one(factory, i + 1, role, anomalies, kind)
        for i, (role, anomalies, kind) in enumerate(schedule)
    ]


# --- writers ------------------------------------------------------------------------------
def _csv(rows: list[dict], columns: list[str]) -> str:
    """Render rows as CSV text with Unix newlines (byte-stable output)."""
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=columns, lineterminator="\n")
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue()


def labels_csv(items: list[Generated]) -> str:
    """labels.csv: one row per planted anomaly and per hard negative."""
    rows = []
    for g in items:
        for label, line_id, detail in g.anomalies:
            rows.append(
                {
                    "invoice_id": g.invoice.invoice_id,
                    "line_id": line_id or "",
                    "label": label,
                    "hard_negative": "",
                    "detail": detail,
                }
            )
        if g.role == "hard_negative":
            rows.append(
                {
                    "invoice_id": g.invoice.invoice_id,
                    "line_id": "",
                    "label": "",
                    "hard_negative": "CLEAN_HARD",
                    "detail": g.hard_kind,
                }
            )
    return _csv(rows, ["invoice_id", "line_id", "label", "hard_negative", "detail"])


def lines_csv(items: list[Generated]) -> str:
    """lines.csv: per-line truth (true HS6, USD per benchmark unit) for classifier tests."""
    rows = []
    for g in items:
        for item, ln in zip(g.invoice.line_items, g.lines, strict=True):
            bench_qty = item.quantity * ln.variant.bench_per_unit
            rows.append(
                {
                    "invoice_id": g.invoice.invoice_id,
                    "line_id": item.line_id,
                    "hs6": ln.expected_hs6 or "",
                    "true_hs6": ln.hs6,
                    "benchmark_unit": cat.COMMODITIES[ln.hs6].benchmark_unit,
                    "bench_units_per_unit": ln.variant.bench_per_unit,
                    "normalised_quantity": round(bench_qty, 6),
                    "unit_price_usd": round(
                        item.unit_price / g.fx_rate / ln.variant.bench_per_unit, 6
                    ),
                    "fx_units_per_usd": g.fx_rate,
                    "label": ln.label,
                }
            )
    cols = [
        "invoice_id", "line_id", "hs6", "true_hs6", "benchmark_unit", "bench_units_per_unit",
        "normalised_quantity", "unit_price_usd", "fx_units_per_usd", "label",
    ]  # fmt: skip
    return _csv(rows, cols)


def invoices_csv(items: list[Generated]) -> str:
    """invoices.csv: one row per invoice with role, template, route and labels."""
    rows = [
        {
            "invoice_id": g.invoice.invoice_id,
            "role": g.role,
            "labels": ";".join(sorted({a[0] for a in g.anomalies})),
            "hard_negative_kind": g.hard_kind,
            "template": g.template,
            "route": f"{g.invoice.seller.country}-{g.invoice.buyer.country}",
            "currency": g.invoice.currency,
            "n_lines": len(g.invoice.line_items),
        }
        for g in items
    ]
    cols = ["invoice_id", "role", "labels", "hard_negative_kind", "template", "route", "currency",
            "n_lines"]  # fmt: skip
    return _csv(rows, cols)


def write(items: list[Generated], out_dir: Path, pdf: bool = True) -> None:
    """Replace truth/ (and pdfs/) in `out_dir` and rewrite the three CSVs."""
    out_dir = Path(out_dir)
    truth_dir = out_dir / "truth"
    truth_dir.mkdir(parents=True, exist_ok=True)
    for old in truth_dir.glob("*.json"):
        old.unlink()
    for g in items:
        (truth_dir / f"{g.invoice.invoice_id}.json").write_text(
            g.invoice.model_dump_json(indent=2) + "\n"
        )
    (out_dir / "labels.csv").write_text(labels_csv(items))
    (out_dir / "lines.csv").write_text(lines_csv(items))
    (out_dir / "invoices.csv").write_text(invoices_csv(items))
    if pdf:
        from tbml.synthetic.render import render_pdf

        pdf_dir = out_dir / "pdfs"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        for old in pdf_dir.glob("*.pdf"):
            old.unlink()
        for g in items:
            render_pdf(g.invoice, g.template, pdf_dir / g.invoice.source_file)


def distribution_table(items: list[Generated]) -> str:
    """Markdown tables of anomaly counts and invoice roles, printed after generation."""
    counts = {t: 0 for t in ANOMALY_TYPES}
    for g in items:
        for label, _, _ in g.anomalies:
            counts[label] += 1
    roles = {r: sum(g.role == r for g in items) for r in ("clean", "anomalous", "hard_negative")}
    out = ["| Label | Count |", "|---|---|"]
    out += [f"| {t} | {c} |" for t, c in counts.items()]
    out += [
        "",
        "| Role | Invoices |",
        "|---|---|",
        *[f"| {r} | {c} |" for r, c in roles.items()],
        f"| total | {len(items)} |",
    ]
    return "\n".join(out)
