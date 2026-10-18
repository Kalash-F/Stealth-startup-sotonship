# Marketing homepage

Scope: the marketing homepage (`/`), the shared site header and footer, and the request-demo and legal pages. The demo workspace (`/app/*`) and sign-in keep their behaviour.

## What was wrong with the previous version

- It failed the 5-second test. The headline ("The goods went one way. The money went another.") was a line of poetry; the only literal clue was a small "Trade-based money laundering investigation" label.
- It was too long: about 14 screens on desktop and 18 on a phone, 2,500 words. CASE-0142 was named ten times and the "same owner" reveal was given away three times before the network section.
- The scroll-driven "follow the money" steps were each 88% of the viewport tall, leaving empty bands.
- It undersold: "fictional", "synthetic" and "illustrative" appeared 17 times, while the real HMRC price data and the evaluation results appeared nowhere.
- One destination had five names ("Open the demo workspace", "Demo workspace", "Workspace", "Explore the platform", "Enter the demo workspace"), and the nav listed essay chapters.
- Product previews looked broken (clipped queue, dimmed graph with a watermark, an empty "Transactions (0)" panel), the background switched theme seven times, and "Company details to follow" and "Draft placeholder" were on show.

## Structure now

A buyer skimming top to bottom gets: what it does, what you get, how, why to trust it, what happens next, how to start. One night surface throughout, about 7 screens on desktop and 1,300 words.

| | Section | Says |
|---|---|---|
| Hero | "Spot mispriced trade invoices in seconds." | Upload an invoice; every line is priced against three years of HMRC import data, with the reasons it needs review. Map below the copy (and right after the buttons on a phone); its default card is the flagged invoice line. |
| 01 Product (`#product`) | "Every flag comes with its reason." | The annotated sample invoice, pins 1 to 5 in reading order, notes in one column. Reflows on a phone instead of scrolling sideways. |
| 02 How it works (`#how-it-works`) | "From PDF to a ranked, explained review." | Read, price, explain, each with what it produced for the sample; the eight checks; "a priority is a reason to look, not a verdict". |
| 03 Data (`#data`) | "Priced against what UK importers actually paid." | 16.1M HMRC records, 9,471 commodity codes, 38 months, 99 percentiles; 17 of 18 planted problems flagged, 0 of 42 clean ones; review-budget chart. One caveat line, OGL attribution. |
| 04 Workspace (`#workspace`) | "Every flagged invoice becomes a case." | Tabs: review queue, case file, network. Queue and case are scaled to fit, never clipped; the network opens with every node visible. |
| Contact (`#contact`) | "Check your first invoice now." | Check an invoice, or request a demo. |

Figures come from `data/databases` build info and `reports/eval/summary.md`; sample-case figures are computed from `src/data`.
