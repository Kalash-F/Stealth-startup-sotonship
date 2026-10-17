# classify: line to HS6 and benchmark unit

`enrich(invoice)` returns one `EnrichedLine` per invoice line: which product it is (an HS6 code), how sure the system is, and the line's quantity and USD price converted to the unit the benchmark band uses.

## Classification

1. **Placeholder check** (`placeholder.py`). Descriptions made only of filler words ("Goods as per contract", "Product ABC") are never sent to a model, because it would invent a code. Such a line gets no HS6 and a confidence of 0.05.
2. **Propose** (`proposers.py`). A `Proposer` returns up to three scored HS6 guesses.
   - `KeywordProposer`: offline baseline using keyword and exclusion patterns from `data/reference/hs6.csv`.
   - `AnthropicProposer`: asks the model for JSON; retries once on bad output.
   - `CachedProposer`: stores answers on disk so reruns are free and repeatable.
   - `default_proposer()` picks the cached LLM when `ANTHROPIC_API_KEY` and `LLM_MODEL` are set, else the keywords.
3. **Validate** (`classifier.py`). Proposals are untrusted: codes not in `hs6.csv` are dropped, the best remaining score must reach 0.5, else the line stays unclassified and the reason is recorded.

The reference list is small and partial (see `data/reference/hs6.csv`; the codes are not yet verified against an official source).

## Normalisation (`normalise.py`)

Converts what is printed to what the benchmark measures:

- quantity to the benchmark unit (`kg`, `l` or `u` for items): weights and volumes by factor, dozens, pairs, cartons with a pack size in the text, bags with a weight in the text or in `unit_weights.csv`, pieces via a documented kg-per-piece row;
- unit price to USD per benchmark unit using `data/reference/fx.csv`.

It never guesses. If a unit, weight or FX rate is missing, quantity and price are `None` and `normalisation_note` says why. When it works, the note shows the whole calculation so an officer can follow it.

The benchmark unit for an HS6 is read from the band table, so it cannot drift from the bands.
