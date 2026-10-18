# QA checklist

Status: `PASS` · `FAIL` · `BLOCK` (could not be checked here) · `TODO`.

Tools available in this environment: Node 22, `next build`, `tsc`, `next lint`, Playwright with bundled Chromium (`scripts/screenshot.mjs`, `tests/*.spec.ts`). No Lighthouse run unless noted.

## Checks

| Check | Routes / components | Status | Notes |
|---|---|---|---|
| Production build | all | PASS | `next build`, 22 static pages |
| Typecheck (`tsc --noEmit`) | all | PASS |  |
| Lint (`next lint`) | all | PASS | no warnings |
| Route availability (200) | all routes in PROJECT_PLAN §3 | PASS | Playwright smoke |
| Nav links resolve, no 404s | site header, footer, app sidebar | PASS | smoke tests fail on any 4xx response; CTA test |
| Console errors | all routes | PASS | none at 1440 or 390 on any route |
| Horizontal overflow at 390px | all routes | PASS | scrollWidth ≤ viewport on every route |
| Investigation filters | `/app/investigations` | PASS | smoke test + agent script (filters persist in URL) |
| Open and leave a case | list → detail → back | PASS | smoke test |
| Case tabs | `/app/investigations/[id]` | PASS | smoke test, all six tabs |
| Mock actions give feedback | case detail, profile menu, workspace switcher | PASS | RFI dialog in smoke test; add note, assign, escalate in agent script |
| Graph node selection and detail panel | `/app/entities` | PASS | deep-link test; clicks in agent script |
| ⌘K search | app shell | TODO | built, not covered by an automated test |
| Sign-in honesty, no credential storage | `/sign-in` | PASS | smoke test: password cleared, status message, nothing sent |
| Demo request honesty | `/request-demo` | PASS | agent script: validation errors, "not been sent" panel |
| Keyboard navigation and focus states | site nav, app nav, tabs, dialogs, checker | PASS | skip link on site and workspace; checker walked by keyboard (picker, zoom, PDF link, disclosures); graph nodes not keyboard-selectable (directory is the keyboard path) |
| WCAG 2.2 AA (axe) | every route, both workspace modes, checker with a report, every case tab | PASS | `tests/a11y.spec.ts`; 0 violations, 0 best-practice issues; non-text contrast of inputs and focus rings computed (3:1) |
| Reflow at 320px | every route, checker with a report | PASS | no horizontal page scroll |
| Reduced motion | global | PASS | global media query disables transitions (code review, not emulated) |
| Data consistency (scores, totals, counts) | overview, list, detail, graph, marketing | PASS | scores computed from flags, dashboard from cases; spot-checked CASE-0142 across hero, overview, detail, graph |
| No fabricated claims, logos, testimonials | marketing | PASS | manual read of homepage |

## Bugs found and fixed

| # | Severity | Where | Issue | Fix |
|---|---|---|---|---|
| 1 | P2 | dialogs, menus, toasts in /app | Portalled UI rendered in light theme | AppShell adds `theme-linen` to body while mounted |
| 2 | P2 | evidence class tags | "◐" glyph missing from Geist Mono, rendered as "‹" | Replaced glyphs with lucide icons |
| 3 | P2 | homepage anomaly showcase | 460px scrollWidth at 390px | Grid fixed by site agent |
| 4 | P3 | homepage capability 04 | Payment amounts wrapped mid-figure | `whitespace-nowrap` on rows |
| 5 | P3 | PriorityScore | "/ 100" wrapped in narrow spaces | `whitespace-nowrap` |
| 6 | P3 | dates | Chrome renders "Sept", charts say "Sep" | Normalised in `lib/format.ts` |
| 7 | P2 | workspace graph | Original layout too wide, labels unreadable | Compact layout in `data/graph-layout.ts` |

## Remaining limitations

- Entity graph is small at 390px; pan and zoom work.
- No Lighthouse run and no full manual keyboard pass yet.
- Front-end only: no auth, persistence or backend. Every mock action says so.
