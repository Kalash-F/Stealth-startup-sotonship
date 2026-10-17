# QA checklist

Status: `PASS` · `FAIL` · `BLOCK` (could not be checked here) · `TODO`.

Tools available in this environment: Node 22, `next build`, `tsc`, `next lint`, Playwright with bundled Chromium (`scripts/screenshot.mjs`, `tests/*.spec.ts`). No Lighthouse run unless noted.

## Checks

| Check | Routes / components | Status | Notes |
|---|---|---|---|
| Production build | all | TODO | |
| Typecheck (`tsc --noEmit`) | all | TODO | |
| Lint (`next lint`) | all | TODO | |
| Route availability (200) | all routes in PROJECT_PLAN §3 | TODO | |
| Nav links resolve, no 404s | site header, footer, app sidebar | TODO | |
| Console errors | all routes | TODO | |
| Horizontal overflow at 390px | all routes | TODO | |
| Investigation filters | `/app/investigations` | TODO | |
| Open and leave a case | list → detail → back | TODO | |
| Case tabs | `/app/investigations/[id]` | TODO | |
| Mock actions give feedback | case detail, profile menu, workspace switcher | TODO | |
| Graph node selection and detail panel | `/app/entities` | TODO | |
| ⌘K search | app shell | TODO | |
| Sign-in honesty, no credential storage | `/sign-in` | TODO | |
| Demo request honesty | `/request-demo` | TODO | |
| Keyboard navigation and focus states | site nav, app nav, tabs, dialogs | TODO | |
| Reduced motion | global | TODO | |
| Data consistency (scores, totals, counts) | overview, list, detail, graph, marketing | TODO | |
| No fabricated claims, logos, testimonials | marketing | TODO | |

## Bugs found and fixed

| # | Severity | Where | Issue | Fix |
|---|---|---|---|---|

## Remaining limitations
