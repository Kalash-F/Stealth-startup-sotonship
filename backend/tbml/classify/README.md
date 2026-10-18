# classify: line to HS6 and benchmark unit

`enrich(invoice)` returns one `EnrichedLine` per invoice line: which product it is (an HS6 code), how sure the system is, and the line's quantity and USD price converted to the unit the benchmark band uses.

## Classification

1. **Placeholder check** (`placeholder.py`). Descriptions made only of filler words ("Goods as per contract", "Product ABC") are never sent to a model, because it would invent a code. Such a line gets no HS6 and a confidence of 0.05.
2. **Propose**. A `Proposer` returns up to three scored HS6 guesses. `default_proposer()` (`proposers.py`) picks one from `CLASSIFIER`:
   - `jev` (default, `jev.py`): **Jev**, TypeSafe's decision model on OpenRouter (`JEV_MODEL`, default `typesafe/jev-1.14`; needs only `OPENROUTER_API_KEY`).
     - If a chat model is configured (`OPENROUTER_MODEL`), it first reads the line in plain words and can stop a vague line ("spare parts"). This is the same step as below, cached in the same place.
     - Jev then decides chapter → heading → HS6. Each level is one Choice question over the real child codes from `hs.db`, plus a `none` option. Jev returns a probability for every option.
     - Beam search keeps the best 3 paths at every level, ranked by the geometric mean of their step probabilities. A level with a single child is taken without a call.
     - Answers are cached in `data/cache/classify_jev/`.
   - `hierarchical` (`hierarchical.py`): the chat model does the same three steps itself, greedily. Its scores are the model's own estimates, and the weakest step caps the final score.
   - `flat`: `LLMProposer`, one chat call straight to HS6, wrapped in `CachedProposer`.
   - `keyword`: `KeywordProposer`, the offline baseline using the keyword patterns in `data/reference/hs6.csv`. It is used whenever no key is set.
3. **Validate** (`classifier.py`). Proposals are untrusted. Codes not in the HS list are dropped, and the best remaining score must reach 0.5; otherwise the line stays unclassified and the reason is recorded. The chosen path (`read as "…" > 84 … (0.97) > 8471 … > 847130 …`) is prepended to `normalisation_note`.

The chat model and Jev are kept apart: Jev's client (`tbml.llm.JevClient`) has no chat methods, and a Jev id put in `OPENROUTER_MODEL`, `LLM_MODEL` or `SUMMARY_MODEL` is ignored with a warning.

## Normalisation (`normalise.py`)

Converts what is printed to what the benchmark measures:

- quantity to the benchmark unit (`kg`, `l` or `u` for items): weights and volumes by factor, dozens, pairs, cartons with a pack size in the text, bags with a weight in the text or in `unit_weights.csv`, pieces via a documented kg-per-piece row;
- unit price to USD per benchmark unit using `data/reference/fx.csv`.

It never guesses. If a unit, weight or FX rate is missing, quantity and price are `None` and `normalisation_note` says why. When it works, the note shows the whole calculation so an officer can follow it.

The benchmark unit for an HS6 is read from the band table, so it cannot drift from the bands.
