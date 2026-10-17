# Website and demo workspace

Marketing site and front-end demo workspace for the TBML investigation product. Built from `website.md`; trackers are `PROJECT_PLAN.md`, `DESIGN_SPEC.md` and `QA_CHECKLIST.md`.

Every company, person, document and payment here is fictional, and the comparison price bands are illustrative, not market data.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build && npm start
npm run typecheck
npm run lint
npm run build && npm run test:e2e   # Playwright smoke tests against the production build
node scripts/screenshot.mjs http://localhost:3000/app out.png 1440 900   # screenshot + console/overflow report
```

## Routes

| Route | What it is |
|---|---|
| `/` | Marketing homepage |
| `/sign-in` | Sign-in screen; no accounts exist, it points to the demo |
| `/request-demo` | Demo request form; front-end only and says so |
| `/legal/privacy`, `/legal/terms` | Draft placeholders |
| `/app` | Demo workspace overview |
| `/app/investigations`, `/app/investigations/[id]` | Case list and case detail |
| `/app/entities` | Entity network and detail panel |
| `/checker` | Reserved for the officer invoice checker (plan.md Phase 7) |

## Layout

- `src/data/` one typed fictional dataset (mirrors plan.md §4 contracts); priority scores and dashboard figures are computed from it.
- `src/components/ui/` shadcn-style primitives on Radix.
- `src/components/domain/` components shared by app and marketing (priority badges, price band bar, flags, entity graph).
- `src/components/app/`, `src/components/marketing/` screen components.
- Product name is a placeholder in `src/lib/brand.ts`.
