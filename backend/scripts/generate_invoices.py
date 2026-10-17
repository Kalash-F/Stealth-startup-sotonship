"""Generate the labelled synthetic invoice set (plan.md Phase 1).

python backend/scripts/generate_invoices.py --seed 42 --n 60 [--out data/synthetic]
"""

import argparse
from pathlib import Path

from tbml.paths import SYNTHETIC_DIR
from tbml.synthetic.generator import DEFAULT_BANDS, distribution_table, generate, write


def main() -> None:
    """Generate the synthetic set and print its label distribution."""
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--n", type=int, default=60)
    p.add_argument("--out", type=Path, default=SYNTHETIC_DIR)
    p.add_argument("--bands", type=Path, default=DEFAULT_BANDS, help="Benchmark JSON")
    p.add_argument("--no-pdf", action="store_true", help="write truth and labels only")
    args = p.parse_args()

    items = generate(args.seed, args.n, bands_path=args.bands)
    write(items, args.out, pdf=not args.no_pdf)
    print(f"wrote {len(items)} invoices to {args.out} (seed {args.seed}, bands {args.bands.name})")
    print(distribution_table(items))


if __name__ == "__main__":
    main()
