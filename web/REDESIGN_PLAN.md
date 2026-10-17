# Marketing redesign plan

Scope: the marketing homepage (`/`) and the shared site header/footer. The demo workspace (`/app/*`), sign-in, request-demo and legal pages keep their behaviour. `/checker` stays reserved.

## What was wrong

The old homepage was a warm-paper SaaS template: two-column hero (serif headline, two buttons, a rectangular product frame), then four "showcase" sections that each repeated the same layout (heading left, dark frame right), then a ruled list, a capability grid and a centred CTA. Every section used the same container, the same frame and the same rhythm. The product was explained; the idea behind it was never shown.

## Concept: "Where trade and money part ways"

Trade-based money laundering hides in the gap between what moves physically and what moves financially. On paper each record is ordinary; the pattern only appears when goods and payments are drawn on the same canvas. The site is built around that single visual idea, using the real sample case (CASE-0142):

- **Goods** travel Ningbo → Jebel Ali → Felixstowe: 2,640 kg of ordinary M8 bolts, worth about USD 5,100 at the illustrative median.
- **Money** travels Tamworth → Jebel Ali (USD 391,900), and then splits: USD 5,180 back to the manufacturer, USD 359,300 on to Plzeň as "consultancy".
- **Ownership** closes the loop: the intermediary and the Plzeň company share a beneficial owner.

Headline: **"The goods went one way. The money went another."** It is literally true of the sample case, and it names the investigative insight rather than the product category.

Visual signature: a hairline dot-matrix map of the Europe–Gulf–East Asia corridor (generated from Natural Earth land at build time, not a stock image), with three line languages used everywhere on the page: dashed neutral for goods, teal for money, vermilion for the link under review. Mono coordinate labels and document references act as the "technical annotation" layer. Instrument Serif at large display sizes carries the editorial voice; Geist Mono carries the evidence.

Palette: an ink/graphite "night" surface (#07090c family) with warm off-white type, one teal accent and one vermilion risk colour, alternating with the existing warm paper for the two editorial sections so the page has light/dark rhythm.

## Narrative (scroll)

| | Section | Surface | Composition | Interaction |
|---|---|---|---|---|
| A | **Hero: the hidden pattern** | night | Full-bleed corridor map above, headline anchored bottom-left, copy and CTAs bottom-right, a callout pinned to the suspicious payment | Routes draw in sequence (goods, money in, split); layer toggles; selectable ports/entities reveal what moved through them; replay |
| B | **Follow the money** | paper | Sticky proportional flow diagram (band width = money) with goods lane above; four narrative steps scroll past it | Scroll position drives which flow is revealed |
| C | **From anomaly to evidence** | night | The invoice as a paper exhibit in the centre, five numbered annotations in the margins with leader marks | Hover/focus an annotation to highlight the invoice field and vice versa |
| D | **The investigation workspace** | graphite | Wide, edge-bleeding product frame with a second layered frame behind it | Tabs switch overview / case / evidence, rendering the real app components |
| E | **The network behind the transaction** | night | Full-width graph with the real entity detail panel docked on the right | Select nodes or quick-select chips; the app's `EntityDetail` updates |
| F | **Investigation, not just detection** | paper | Editorial spread: a huge score on the left ("this is a detection") against the case's reasoning ledger on the right | Static, typographic |
| G | **Enter the platform** | night | Large headline and CTAs over a big real dashboard frame that rises out of the section | Links into `/app`, `/app/investigations/CASE-0142`, `/request-demo` |

## Implementation notes

- No new runtime dependencies. Motion is CSS (stroke-dashoffset, transitions) plus a small IntersectionObserver hook; everything is static when `prefers-reduced-motion` is set.
- Land dots are generated once by `scripts/build-land-dots.mjs` (dev deps: world-atlas, topojson-client, d3-geo) into a run-length encoded TS file and drawn as one SVG path.
- All figures come from `src/data` (or are computed from it); fictional-data and illustrative-range labels stay visible.
- Real components reused: `PriceBandBar`, `FlagItem`, status badges, `EntityGraph`, `EntityDetail`, `KpiStrip`, `AttentionQueue`, `ScreeningChart`, `FlagsByRuleChart`, `SummaryTab`, `InvoiceTab`.
- Header and footer move to the night surface; the old hero, showcase, how-it-works and capabilities sections are retired.

## QA loop

Build, typecheck, lint, Playwright smoke; screenshots at 1440 and 390 of the full page and each section; hero interactions, CTAs and navigation into `/app` exercised in Chromium; console and overflow checked; five weakest points fixed and re-shot.
