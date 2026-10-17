"""python -m tbml.extract <file.pdf> [--no-llm] [--raw]: print the extracted Invoice as JSON."""

import argparse
import sys

from tbml.extract import extract_document
from tbml.extract.pdftext import read_pdf


def main() -> int:
    """Parse arguments, run extraction, print the Invoice JSON to stdout and diagnostics to
    stderr."""
    ap = argparse.ArgumentParser(prog="python -m tbml.extract", description=__doc__)
    ap.add_argument("pdf")
    ap.add_argument("--no-llm", action="store_true", help="skip cache and LLM; layout parser only")
    ap.add_argument("--raw", action="store_true", help="print the raw extracted text and exit")
    args = ap.parse_args()
    if args.raw:
        print(read_pdf(args.pdf).render())
        return 0
    result = extract_document(args.pdf, use_llm=not args.no_llm)
    print(result.invoice.model_dump_json(indent=2))
    print(f"method: {result.method}; llm calls: {result.llm_calls}", file=sys.stderr)
    for w in result.warnings:
        print(f"warning: {w}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
