# Design spec

Source of truth for the visual system. Tokens live in `src/app/globals.css`; components only reference semantic tokens.

## Direction

Somewhere between financial infrastructure software and an investigator's case file. Precise, calm, high-signal. The marketing site reads like a well-set document on warm paper; the workspace is a dark graphite instrument. They share one type system, one accent, one status vocabulary and the same components, so a product preview on the marketing page is the real component in a dark frame.

What we deliberately avoid: gradients, glows, blobs, glassmorphism, pill buttons, three-identical-card rows, logo strips, testimonials, stock photography, emoji icons.

## Surfaces and colour tokens

Two themes share token names. Wrap a subtree in `.theme-ink` to render it as the workspace.

| Token | Paper (marketing) | Ink (app) | Use |
|---|---|---|---|
| `bg` | `#f3f0e9` warm stone | `#0c1015` graphite | page background |
| `surface` | `#fbfaf6` | `#11161d` | panels, inputs |
| `surface-2` / `surface-3` | `#ebe7dd` / `#e2ddd0` | `#171e27` / `#1e2732` | hover, selected, nested |
| `border` / `border-strong` | `#d9d3c5` / `#b9b1a0` | `#242e3a` / `#354253` | 1px rules |
| `fg` / `fg-muted` / `fg-subtle` | `#15171b` / `#555a62` / `#7b7f86` | `#e5e9ee` / `#9aa5b2` / `#6c7886` | type |
| `accent` | `#0d7468` deep teal | `#3cc4b0` signal teal | the one brand colour: active state, money flows, focus |

Semantic colours (each has a `-soft` background pair):

| Token | Meaning | Always paired with |
|---|---|---|
| `risk-low` | Low priority, within range | ● glyph + "Low" |
| `risk-review` | Review priority, medium severity, anomaly | ■ / ⚠ + label |
| `risk-high` | Review now, high severity, risk indicator, stated price outside range | ▲ / shield + label |
| `finding` | Confirmed finding (an established fact, not a verdict) | ● + "Confirmed finding" |
| `info` | New / informational | icon + label |

Colour never carries meaning alone: every status has a glyph or icon and a word.

## Typography

- **Geist Sans** (400/500/600): headings and interface text. Tight tracking on headings (−0.015em to −0.03em).
- **Geist Mono**: identifiers (case ids, invoice refs, payment refs), financial figures in tables, eyebrows, badges. Always `tabular-nums` for numbers.
- **Instrument Serif**: marketing display headlines and one or two editorial pull-quotes only. Never inside the app.

Scale (rem): 0.6875 (badges/eyebrows), 0.75, 0.8125 (app body), 0.875, 1, 1.25, 1.375 (app h1), 2.25–4.5 (marketing display, serif). App headings never exceed 22px.

## Spacing, radius, borders, shadow

- 4px base grid. App gutters 16px (mobile) / 24px (desktop). Marketing section padding 96–128px vertical on desktop, 64px on mobile.
- Radius: `xs` 2px (badges), `sm` 4px (buttons, inputs), `md` 6px (panels, nodes), `lg` 10px (marketing product frames only). No fully rounded pills except avatars.
- Borders: 1px `border`. `border-strong` for inputs and secondary buttons.
- Shadow: one token, `shadow-frame`, for marketing product frames, dialogs and menus. Panels in the app are flat.

## Component patterns

- **Button**: rectangular, `sm`/`md`/`lg`. `primary` (ink on paper / paper on ink), `accent` (one per view at most), `secondary` (bordered), `ghost`, `link`.
- **Badge**: square, mono, uppercase, 11px. Used for priority, severity, evidence class, "fictional data".
- **Case status**: icon + plain text, not a badge, to keep tables calm.
- **Panel**: flat surface, 1px border, `PanelHeader` with 13px semibold title and optional actions.
- **Tables**: 13px body, mono for ids and money, right-aligned numbers, row hover `surface-2`, whole row clickable via the primary cell link, sticky header on long tables, horizontal scroll container under `md`.
- **Inputs**: 36px tall, `border-strong`, accent focus ring.
- **Price band bar**: log-scale p10–p90 thin bar, p25–p75 thick bar, median tick, stated price diamond (red outside band, green inside). Always captioned with numbers.
- **Entity graph**: React Flow. Entities are solid rounded nodes; documents and payments are dashed square nodes. Money edges accent, goods/document edges neutral, ownership dashed, under-review edges risk-high. Selecting a node dims everything except its neighbours.

## Marketing ↔ application

Marketing uses paper; product previews sit in `.theme-ink` frames (`radius-lg`, `shadow-frame`) and render real components with the shared dataset. Copy on the marketing site refers to the same case ids, companies and figures as the app.

## Motion

Only transitions that explain state: hover colour, tab underline, drawer slide, graph neighbour dimming. 150–200ms ease-out. No scroll-jacking, parallax or animated backgrounds. `prefers-reduced-motion` disables transitions globally.

## Responsive

- ≥1024px: app sidebar visible; multi-panel layouts.
- 768–1023px: sidebar becomes a drawer; two-column panels collapse to one.
- <768px: tables scroll horizontally inside their panel, or switch to stacked rows where noted; the graph keeps a fixed-height canvas with pan/zoom and the detail panel stacks below it.
- Marketing: nav collapses to a menu button under 900px; hero visual stacks below copy; showcases become single column.
