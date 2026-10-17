# synthetic: labelled test invoices

Generates fictional invoices with known ground truth, so extraction, classification and rules can be measured. Everything is invented: company names, streets and postcodes are fictional, while city and port names are real so geography rules have something to check.

```bash
make synthetic              # SEED=42 N=60 by default
python backend/scripts/generate_invoices.py --seed 7 --n 120 --out /tmp/inv --no-pdf
```

Same seed, same truth files. (PDFs differ byte-for-byte because WeasyPrint embeds a timestamp.)

## Output (`data/synthetic/` by default)

| File | Content |
|---|---|
| `pdfs/<id>.pdf` | Rendered text-based invoice, with a visible synthetic-document notice |
| `truth/<id>.json` | The exact `Invoice` the PDF was rendered from |
| `labels.csv` | One row per planted anomaly and per hard negative |
| `lines.csv` | Per-line truth the `Invoice` contract cannot hold: true HS6, quantity and USD price in the benchmark unit |
| `invoices.csv` | One row per invoice: role, labels, template, route, currency |

## How the set is built

- Roles: about 30 percent `anomalous`, 10 percent `hard_negative`, the rest `clean`. Each anomaly type appears several times; some invoices carry two.
- Prices are sampled inside the benchmark band (p25 to p75) for clean lines and pushed well outside it for planted price anomalies.
- Hard negatives look suspicious but are legitimate: a premium price near p90, a bulk discount near p10, an unusual route the invoice explains.
- Three templates (`classic`, `modern`, `trade` in `templates/`) test that extraction does not depend on one layout.

## Files

| File | Role |
|---|---|
| `generator.py` | Schedule, invoice construction, anomaly planting, CSV and PDF writers |
| `catalogue.py` | Vocabulary: products and how they are described, routes, cities, names |
| `render.py` | Jinja2 plus WeasyPrint rendering |
| `templates/` | The three HTML invoice templates |

The default bands are placeholders in `data/reference/placeholder_bands.json`. Once real bands exist, regenerate with `--bands data/benchmarks/bands.json` and update `DEFAULT_BANDS` (see `DECISIONS.md` D1.2).
