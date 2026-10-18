"""R1 PRICE_OUTLIER: the stated unit price against the benchmark band.

Two kinds of band:
- Bands from the benchmark databases carry p1 to p99 for each year and for all years pooled.
  The price is judged on the band's tails, then checked against every period of the series, the
  other basis (per kg / per unit) and the origin country's band (DECISIONS D11.2).
- The older JSON bands carry p10 to p90 only and are judged on a log scale as before.
"""

from __future__ import annotations

import math
from typing import Any

from tbml.rules._common import (
    config,
    fmt_money,
    fmt_ratio,
    make_flag,
    mock_note,
    paired,
    product_name,
    unit_label,
)
from tbml.rules._geo import country_name
from tbml.schemas import (
    Benchmark,
    EnrichedLine,
    Flag,
    Invoice,
    LineItem,
    PriceBand,
    Rule,
    Severity,
)

_DOWN = {Severity.high: Severity.medium, Severity.medium: Severity.low, Severity.low: Severity.low}


def check(
    invoice: Invoice,
    enriched: list[EnrichedLine],
    benchmarks: list[Benchmark | None],
    warnings: list[str] | None = None,
) -> list[Flag]:
    """Flag each line whose USD unit price is out of line with its benchmark band.

    Database bands (with tails): see `_check_tails`. Other bands: medium outside the p10-p90
    band, high when the log-distance from the median exceeds `high_spread_multiple` times the
    band's own log-width. Lines with no band or no usable price are skipped with a warning."""
    cfg = config("price_outlier")
    flags: list[Flag] = []
    for item, e, b in paired(invoice, enriched, benchmarks):
        price = e.unit_price_usd
        if b is None or price is None or price <= 0 or b.median <= 0 or b.p10 <= 0:
            if warnings is not None:
                warnings.append(
                    f"line {item.line_id}: no price benchmark or usable price, so the price check was skipped"
                )
            continue
        if b.p1 is not None and b.p5 is not None and b.p95 is not None and b.p99 is not None:
            flag = _check_tails(cfg, invoice, item, e, b, price)
        else:
            flag = _check_band(cfg, item, e, b, price)
        if flag is not None:
            flags.append(flag)
    return flags


def _check_band(
    cfg: dict, item: LineItem, e: EnrichedLine, b: Benchmark, price: float
) -> Flag | None:
    """The p10-p90 check for bands without tails (the JSON band tables)."""
    log_dev = math.log(price / b.median)
    spread = math.log(b.p90 / b.p10)
    if b.p10 <= price <= b.p90:
        return None
    high = abs(log_dev) > cfg["high_spread_multiple"] * spread
    over = price > b.median
    ratio = price / b.median if over else b.median / price
    unit = unit_label(b.unit)
    what = product_name(item, e)
    band = f"{fmt_money(b.p10)} to {fmt_money(b.p90)} per {unit}"
    if over:
        reason = (
            f"Over-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
            f"{fmt_ratio(ratio)} times the typical price of {fmt_money(b.median)} per {unit}, "
            f"{'far outside' if high else 'above'} the normal range of {band}."
        )
    else:
        reason = (
            f"Under-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
            f"{fmt_ratio(ratio)} times lower than the typical price of {fmt_money(b.median)} per {unit}, "
            f"{'far outside' if high else 'below'} the normal range of {band}."
        )
    return make_flag(
        Rule.PRICE_OUTLIER,
        item.line_id,
        Severity.high if high else Severity.medium,
        reason + mock_note(b),
        {
            "unit_price_usd": price,
            "median": b.median,
            "p10": b.p10,
            "p90": b.p90,
            "log_dev": round(log_dev, 2),
            "spread": round(spread, 2),
            "direction": "over" if over else "under",
            "benchmark_unit": unit,
            "benchmark_route": b.route,
            "benchmark_sources": b.sources,
            "benchmark_is_mock": b.is_mock,
        },
        expected=band,
        stated=f"{fmt_money(price)} per {unit}",
        variance_pct=(price / b.median - 1) * 100,
    )


def position(price: float, band: Benchmark | PriceBand) -> str:
    """Where a price sits in a band with tails: 'extreme_low' (< p1), 'low' (p1 to p5),
    'normal' (p5 to p95, edges included), 'high' (p95 to p99), 'extreme_high' (> p99)."""
    assert (
        band.p1 is not None
        and band.p5 is not None
        and band.p95 is not None
        and band.p99 is not None
    )
    if price < band.p1:
        return "extreme_low"
    if price < band.p5:
        return "low"
    if price > band.p99:
        return "extreme_high"
    if price > band.p95:
        return "high"
    return "normal"


def _side(pos: str) -> str | None:
    return "under" if pos.endswith("low") else "over" if pos.endswith("high") else None


def _period_name(period: str) -> str:
    return "all years pooled" if period == "all" else period


def _join(items: list[str]) -> str:
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def _other_basis_price(
    invoice: Invoice, item: LineItem, e: EnrichedLine, band: PriceBand
) -> tuple[float, str] | None:
    """The line's USD price in the other band's unit, if the line converts to it with documented
    data (e.g. counted screws with a weight per piece). None otherwise."""
    from tbml.classify.normalise import _units_per_printed, load_fx

    rate = load_fx().get(invoice.currency)
    if e.hs6 is None or rate is None or band.unit not in ("u", "l", "pr", "kg"):
        return None
    per, how = _units_per_printed(e.hs6, item.unit, item.description.lower(), band.unit)
    if per is None or per <= 0:
        return None
    return item.unit_price / rate / per, how


def _check_tails(
    cfg: dict, invoice: Invoice, item: LineItem, e: EnrichedLine, b: Benchmark, price: float
) -> Flag | None:
    """Judge a price on a database band: tier on the band's own tails, then move the severity and
    the score up or down with how consistently the rest of the evidence agrees.

    1. Tier on the recommended band: p5-p95 normal (no flag), p1-p5 / p95-p99 review (medium),
       beyond p1 / p99 extreme (high).
    2. Periods: the same check against each year with enough prices and all years pooled.
       agreement = share of periods where the price is also outside p5-p95 on the same side.
       Below `weak_agreement` the severity drops one level (the price was normal most of the
       time, so the band's year may be the odd one out); a review-tier price that is extreme in
       at least `escalate_extreme_share` of the periods rises to high.
    3. Other basis (per kg for a per-unit band and the reverse), when the line converts to it:
       out of range on the same side too -> medium rises to high (rules out a unit or weight
       slip; both extreme is the strongest signal); normal there -> one level down.
    4. The origin country's own band and the year-on-year drift are reported as context. The
       origin never raises a flag or clears one (a whole route can be mispriced); it only lowers a
       review-tier price that is normal for its origin by one level (`origin_softens_review`).
    The flag's score points are scaled by `score_factor` (scoring.weights x factor)."""
    pos = position(price, b)
    side = _side(pos)
    if side is None:
        return None
    over = side == "over"
    extreme = pos.startswith("extreme")
    severity = Severity.high if extreme else Severity.medium
    unit = unit_label(b.unit)
    what = product_name(item, e)
    period = _period_name(b.period or "recommended")
    n_fmt = f"{b.n_observations:,}"
    adjustments: list[str] = []

    # 2. every period of the series
    periods = [h for h in b.history if h.n_observations >= cfg["min_period_prices"]]
    rows: list[dict[str, Any]] = []
    for h in periods:
        p = position(price, h)
        rows.append(
            {
                "period": h.period,
                "n_observations": h.n_observations,
                "p1": round(h.p1, 6),
                "p5": round(h.p5, 6),
                "median": round(h.median, 6),
                "p95": round(h.p95, 6),
                "p99": round(h.p99, 6),
                "position": p,
                "median_vs_prev_year": h.median_vs_prev_year,
            }
        )
    agreeing = [r["period"] for r in rows if _side(r["position"]) == side]
    extreme_in = [
        r["period"] for r in rows if r["position"] == ("extreme_high" if over else "extreme_low")
    ]
    normal_in = [r["period"] for r in rows if r["position"] == "normal"]
    agreement = len(agreeing) / len(rows) if rows else None
    lo, hi = cfg["score_factor_min"], cfg["score_factor_max"]
    factor = 1.0 if agreement is None else lo + (hi - lo) * agreement

    if agreement is not None:
        if agreement < cfg["weak_agreement"]:
            severity = _DOWN[severity]
            adjustments.append(
                f"Severity lowered: the price was within the normal range in {_join([_period_name(p) for p in normal_in]) or 'most periods'}, "
                "so prices for this code may have moved"
            )
        elif (
            severity == Severity.medium
            and len(extreme_in) / len(rows) >= cfg["escalate_extreme_share"]
        ):
            severity = Severity.high
            adjustments.append(
                f"Severity raised: the price is beyond the {'99th' if over else '1st'} percentile in "
                f"{len(extreme_in)} of {len(rows)} periods"
            )

    # 3. the other basis
    other: dict[str, Any] | None = None
    if b.other_basis is not None:
        converted = _other_basis_price(invoice, item, e, b.other_basis)
        if converted is not None:
            alt_price, how = converted
            alt_pos = position(alt_price, b.other_basis)
            alt_unit = unit_label(b.other_basis.unit)
            other = {
                "unit_price_usd": round(alt_price, 6),
                "unit": alt_unit,
                "conversion": how,
                "position": alt_pos,
                "median": round(b.other_basis.median, 6),
                "p5": round(b.other_basis.p5, 6),
                "p95": round(b.other_basis.p95, 6),
                "period": b.other_basis.period,
                "level": b.other_basis.level,
            }
            if _side(alt_pos) == side:
                if alt_pos.startswith("extreme") and extreme:
                    factor = hi
                    adjustments.append(
                        f"Per {alt_unit} the price ({fmt_money(alt_price)}) is extreme as well, which rules out "
                        "a simple unit or weight slip: the strongest sign of mispricing"
                    )
                else:
                    adjustments.append(
                        f"Per {alt_unit} the price ({fmt_money(alt_price)}) is also outside the normal range "
                        f"of {fmt_money(b.other_basis.p5)} to {fmt_money(b.other_basis.p95)}"
                    )
                if severity == Severity.medium:
                    severity = Severity.high
            elif alt_pos == "normal":
                severity = _DOWN[severity]
                factor = lo
                adjustments.append(
                    f"Severity lowered: per {alt_unit} the price ({fmt_money(alt_price)}) is normal, so check "
                    "the quantity and unit on the invoice first"
                )

    # 4. context: origin country and year-on-year drift
    context: list[str] = []
    origin: dict[str, Any] | None = None
    if b.origin_band is not None:
        ob = b.origin_band
        opos = position(price, ob)
        origin = {
            "origin": ob.origin,
            "period": ob.period,
            "n_observations": ob.n_observations,
            "median": round(ob.median, 6),
            "p5": round(ob.p5, 6),
            "p95": round(ob.p95, 6),
            "position": opos,
        }
        verdict = (
            "also outside it"
            if _side(opos) == side
            else "within it"
            if opos == "normal"
            else "outside it"
        )
        context.append(
            f"For imports from {country_name(ob.origin)} the normal range is {fmt_money(ob.p5)} to "
            f"{fmt_money(ob.p95)} per {unit} (median {fmt_money(ob.median)}); the price is {verdict}"
        )
        if opos == "normal" and not extreme and cfg["origin_softens_review"]:
            severity = _DOWN[severity]
            context.append(
                "Severity lowered because the price is usual for that origin; it is still reported "
                "because a whole route can be mispriced"
            )
    drift = next((h.median_vs_prev_year for h in b.history if h.period == b.period), None)
    if drift is not None and abs(drift - 1) * 100 >= cfg["drift_note_pct"]:
        context.append(
            f"Prices for this code {'rose' if drift > 1 else 'fell'} {abs(drift - 1) * 100:.0f}% in {b.period} "
            "against the year before"
        )

    ratio = price / b.median if over else b.median / price
    tail = (
        f"above the 99th percentile ({fmt_money(b.p99)})"
        if pos == "extreme_high"
        else f"between the 95th and 99th percentiles ({fmt_money(b.p95)} to {fmt_money(b.p99)})"
        if pos == "high"
        else f"below the 1st percentile ({fmt_money(b.p1)})"
        if pos == "extreme_low"
        else f"between the 1st and 5th percentiles ({fmt_money(b.p1)} to {fmt_money(b.p5)})"
    )
    level = (
        f" (compared at heading level, HS {b.code}, because the 6-digit code has too few prices)"
        if b.level == "hs4"
        else ""
    )
    if over:
        lead = (
            f"Over-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
            f"{fmt_ratio(ratio)} times the typical price of {fmt_money(b.median)} per {unit}, {tail} "
            f"of {n_fmt} UK import prices in {period}{level}."
        )
    else:
        lead = (
            f"Under-invoiced: the stated price of {fmt_money(price)} per {unit} for {what} is about "
            f"{fmt_ratio(ratio)} times lower than the typical price of {fmt_money(b.median)} per {unit}, "
            f"{tail} of {n_fmt} UK import prices in {period}{level}."
        )
    years = (
        f" Out of line in {len(agreeing)} of {len(rows)} periods checked ({_join([_period_name(p) for p in agreeing])})."
        if rows and agreeing
        else ""
    )
    extra = "".join(f" {s}." for s in adjustments + context)
    band = f"{fmt_money(b.p5)} to {fmt_money(b.p95)} per {unit}"
    return make_flag(
        Rule.PRICE_OUTLIER,
        item.line_id,
        severity,
        lead + years + extra,
        {
            "unit_price_usd": price,
            "median": b.median,
            "p1": b.p1,
            "p5": b.p5,
            "p10": b.p10,
            "p90": b.p90,
            "p95": b.p95,
            "p99": b.p99,
            "tier": "extreme" if extreme else "review",
            "position": pos,
            "direction": side,
            "periods": rows,
            "agreement": None if agreement is None else round(agreement, 2),
            "periods_out_of_range": agreeing,
            "periods_extreme": extreme_in,
            "other_basis": other,
            "origin_context": origin,
            "score_factor": round(factor, 2),
            "benchmark_level": b.level,
            "benchmark_code": b.code,
            "benchmark_basis": b.basis,
            "benchmark_period": b.period,
            "n_observations": b.n_observations,
            "benchmark_unit": unit,
            "benchmark_route": b.route,
            "benchmark_sources": b.sources,
            "benchmark_is_mock": b.is_mock,
        },
        expected=f"{band} (normal range p5-p95, {period})",
        stated=f"{fmt_money(price)} per {unit}",
        variance_pct=(price / b.median - 1) * 100,
    )
