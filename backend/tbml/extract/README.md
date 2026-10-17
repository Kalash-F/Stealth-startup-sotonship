# extract: PDF to Invoice

Turns an invoice PDF into an `Invoice` (see `schemas.py`). Entry points: `extract_document(path)` returns an `ExtractionResult` (invoice, warnings, method used, LLM call count); `extract(path)` returns just the invoice.

## Order of attempts

1. **Cached LLM reply**, keyed by the file's SHA-256 and the prompt version (`llm.py`). Method `llm-cache`.
2. **LLM structuring**, only when `ANTHROPIC_API_KEY` and `LLM_MODEL` are set. The model gets the PDF's text and tables and must return JSON matching the `Invoice` schema; on a parse or validation failure it is asked once more with the error. Method `llm`.
3. **Layout parser** (`layout.py`). Deterministic, offline, reads word positions for the three known templates (`classic`, `modern`, `trade`). Method `layout`.
4. **Minimal invoice**: an empty, schema-valid placeholder with warnings, for scanned PDFs (no text layer) or unknown layouts. Method `minimal`.

An LLM failure (network, auth, invalid output) becomes a warning and the next path is tried.

## Rules the code follows

- **Numbers are copied, never repaired.** An arithmetic error on the invoice must reach rule R6 unchanged.
- **Every number is checked against the document text** (`numbers.py`). A quantity, price, line total or stated total not found in the text drops that line's `extraction_confidence` to at most 0.5 and adds a warning. Rule R8 then asks for a manual read.
- **Address type** comes from keyword heuristics first (`address.py`: P.O. box, flat/apartment, unit/warehouse/office, company suffix) and the LLM's answer only where the keywords are not decisive.
- **`is_synthetic`** is true when the PDF carries the "SYNTHETIC TEST DOCUMENT" notice.

## Files

| File | Role |
|---|---|
| `__init__.py` | Orchestration and the post-processing step `_finalise`. |
| `pdftext.py` | pdfplumber wrapper: text, tables and positioned words (`RawDocument`). |
| `llm.py` | Prompt, Anthropic client, JSON validation with one retry, disk cache. |
| `layout.py` | Template detection and per-template parsers. |
| `address.py`, `countries.py`, `numbers.py` | Address type, country names to ISO codes, tolerant number parsing. |
| `scoring.py` | Field-by-field accuracy against ground truth (`python -m tbml.extract.scoring`). |
| `__main__.py` | The command-line entry point. |

Adding a template means adding a `_parse_<name>` function in `layout.py` that returns the field dict, a detection rule in `_detect`, and a synthetic template to test it.
