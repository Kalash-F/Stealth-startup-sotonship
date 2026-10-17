# Project plan · Website and demo workspace

Tracker for the TBML marketing website and front-end demo, built from the website brief `website.md` (not committed to this repo; it replaces Phase 8 of `plan.md`). Lives in `web/`. Status keys: `[ ]` not started · `[/]` in progress · `[x]` implemented and verified · `[!]` blocked or failed.

## 1. Vision and audience

One product with two faces: a marketing site that explains how trade-based money laundering is surfaced and investigated, and a demo workspace a visitor can walk through. Audience: AML and financial crime investigators, trade finance compliance, FIU and customs intelligence teams. The product is presented as an investigation workspace, never as a fraud-score oracle. Output is a review priority with reasons; the investigator decides.

## 2. Visual direction

See `DESIGN_SPEC.md`. Marketing redesign (Oct 2026, `REDESIGN_PLAN.md`): ink-black "night" surfaces alternating with warm paper, a dot-matrix corridor map as the visual signature, goods/money/ownership line languages, real workspace components as product visuals. Workspace stays graphite.

## 3. Routes (page inventory)

| Route | Purpose | Status | Verified by |
|---|---|---|---|
| `/` | Marketing homepage, redesigned as one story (see REDESIGN_PLAN.md): trade-map hero, follow the money, evidence exhibit, workspace tabs, network, editorial, enter | [x] | Smoke at 1440/390 + homepage interaction tests; section screenshots at 1024/1440/1920/390 reviewed |
| `/sign-in` | Sign-in screen with honest demo entry; no credential handling | [x] | Smoke + credential test (password cleared, status message) |
| `/request-demo` | Demo request form; front-end only, says so on submit | [x] | Smoke + validation and not-sent panel checked by agent script |
| `/legal/privacy`, `/legal/terms` | Placeholder legal pages, clearly marked as drafts | [x] | Smoke at 1440/390 |
| `/app` | Overview dashboard | [x] | Smoke; screenshots reviewed at 1440/390 |
| `/app/investigations` | Case list with search and filters | [x] | Smoke + filter-and-open test |
| `/app/investigations/[id]` | Case detail with tabs | [x] | Smoke + tabs and RFI dialog test; all 10 cases prerendered |
| `/app/entities` | Entity network graph + detail panel, deep-linkable `?entity=` | [x] | Smoke + deep-link detail test |
| `/checker` | **Reserved** for the officer invoice checker (plan.md Phase 7), built by another thread against the backend API. Not created here. | — | |

No separate `/product` page: the homepage carries the product story and the demo is one click away.

## 4. Application screens and interactions

- Shell: sidebar (overview, investigations, entities), workspace switcher, ⌘K search across cases/invoices/entities, profile menu with demo persona, persistent demo banner.
- Overview: attention queue, priority distribution, screening trend, flags by rule, value by corridor, recent activity.
- Investigations: filter by text, status, priority band, corridor; sort; row opens case.
- Case detail: summary with next action, evidence assessment (anomaly / risk indicator / confirmed finding), invoice lines with price band bars, flags, timeline, related transactions, network excerpt, notes. Mock actions (add note, request information, escalate, assign) show visible feedback and say nothing is saved.
- Entities: graph of the Orchard Gate network, node selection opens detail panel, navigate between related entities and cases.

## 5. Stack

Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, shadcn-style primitives on Radix (tabs, dialog, dropdown, tooltip, slot), lucide-react, Recharts (charts), @xyflow/react (graph), sonner (toasts), Geist + Instrument Serif via npm (no CDN fonts). Playwright (bundled Chromium) for screenshots and smoke tests. Not installed: TanStack Table (cases fit a hand-rolled sortable table), Motion (CSS transitions suffice).

## 6. Components

- `components/ui/*`: Button, Badge, Panel, Input/Textarea/Label, Tabs, Dialog/Sheet, DropdownMenu, Tooltip.
- `components/domain/*` (shared by app and marketing): PriorityBadge, PriorityScore, SeverityTag, CaseStatusLabel, EvidenceClassTag, SyntheticBadge, PriceBandBar, FlagList/FlagItem, EntityGraph/GraphLegend, Logo.
- `components/app/*`: AppShell, QuickSearch, PageHeader, plus screen components.
- `components/marketing/*`: site header/footer and sections.

## 7. Dataset and narrative

All in `src/data/`, typed to mirror plan.md §4 contracts, every record fictional. Ten cases across the plan.md corridors (CN-GB, AE-GB, GB-AE, AE-CZ) and seven HS6 commodities, using the eight plan.md rule types and its scoring weights (high 40, medium 15, low 5; ≥60 review now, 25–59 review). Priority scores are computed from flags, dashboard aggregates are computed from cases, so screens cannot disagree.

**Central case, CASE-0142.** Orchard Gate General Trading FZE (Jebel Ali) invoices Calder Brook Industrial Supplies (Tamworth) USD 391,900 for zinc-plated M8 bolts made by Yongjia Hexa Fasteners (Ningbo). The bolt price is about 92× the illustrative median, a USD 48,500 line says only "Goods as per contract", and the origin reads "Ningbo, United Arab Emirates". Orchard Gate pays the manufacturer USD 5,180 and forwards USD 359,300 to Vltava Componenta (Plzeň) as "consultancy" within 48 hours of each receipt. A registry check confirms both companies share a beneficial owner, D. Ferrant. Vltava separately buys copper cathodes far below range (CASE-0145), and Orchard Gate also sold USB drives at laptop prices to Morava Datatech (CASE-0139, escalated). A repeat invoice arrives as CASE-0147. Status: awaiting the importer's response to an RFI before an escalation decision.

Hard negatives are included: CASE-0126 (premium laptops near p90, closed) and CASE-0128 (clerical arithmetic error, closed).

## 8. Phases and checkpoints

| # | Phase | Owner | Status | Definition of done |
|---|---|---|---|---|
| 0 | Environment and feasibility | lead | [x] | Repo empty apart from LICENSE/README; Node 22, npm, bundled Chromium available; Next build runs. |
| 1 | Architecture and design direction | lead | [x] | Routes, dataset, design spec, component inventory written (this file, DESIGN_SPEC.md). |
| 2 | Design system and app shell | lead | [x] | Tokens, primitives, shell render cleanly at 1440 and 390; screenshot reviewed. |
| 3 | Core investigation experience | app agent | [x] | Four app routes built on shared data; navigation, filters, tabs, graph selection verified in browser. |
| 4 | First visual review | lead | [x] | Screenshots of each app screen at desktop and mobile; top five fixes applied. |
| 5 | Marketing website | site agent | [x] | All sections, real components in previews, no unsupported claims. |
| 6 | Sign-in and demo journey | forms agent | [x] | Sign-in, request demo, legal pages; honest mock behaviour; no credential storage. |
| 7 | Functional verification | lead | [x] | Build, typecheck, lint, Playwright smoke across routes, console clean. |
| 8 | Responsive and accessibility | lead | [/] | 1440 / 768 / 390 screenshots, keyboard pass, overflow check. |
| 9 | Final refinement | lead | [x] | P0/P1 resolved, P2 where practical. |
| 10 | Handover | lead | [x] | Plan and QA checklist reflect what was verified; merged to main in PR #3. |

## 9. Current state

- **Marketing redesign (merged to main in PR #7):** homepage rebuilt around CASE-0142 ("The goods went one way. The money went another."). Old hero/showcases/how-it-works/capabilities/methodology/final-cta retired. Header and footer moved to the night surface. Build, tsc, lint and 27 Playwright tests pass.

- **Done:** all routes built and verified (build, tsc, lint, 23 Playwright smoke tests, screenshots at 1440 and 390 reviewed).
- **Built by:** lead (foundation, review), an Opus agent (app screens), a Sonnet agent (marketing), a Haiku agent (sign-in, request demo, legal).
- **Current:** merged to main (PR #3). The site and workspace run on the fictional dataset only; nothing calls the backend yet.
- **Next:** product name decision; the `/checker` route against the backend API.
- **Not yet done:** a full manual keyboard pass and a Lighthouse run; 768px checked by the agents only.
- **Known issues (P2/P3):** full entity graph is small at 390px (pan/zoom works); graph nodes are not keyboard-selectable (directory and connection buttons are the keyboard path); case actions are page-local and not reflected on the list or dashboard (toasts say so); workspace graph uses a compact layout (`data/graph-layout.ts`) while marketing uses `network.ts` positions.
- **Decisions to keep consistent:** product name "Lading" is a placeholder in `src/lib/brand.ts`; `/checker` is reserved; benchmark bands are illustrative and labelled so everywhere; "Confirmed finding" means an established fact, never a verdict of wrongdoing.

## 10. Limitations

- Front-end only. No authentication, persistence or backend; all actions are simulated with visible feedback.
- Benchmark bands are synthetic and not market prices.
- Product name is a placeholder pending a decision.
