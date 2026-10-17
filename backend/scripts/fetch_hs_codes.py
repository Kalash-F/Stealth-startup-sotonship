"""Fetch every HS6 code on the World Bank WITS website and write it as SQL: hs2 -> hs4 -> hs6.

Run:  python backend/scripts/fetch_hs_codes.py [--out DIR] [--db hs.db] [--workers 4]
Load: --db writes the tables into a SQLite database; for PostgreSQL run psql -f on each file, in
      name order.

Sources, all on wits.worldbank.org (no key needed). The website uses HS 1988/92 (H0) codes:
- hs6 codes and hs2 names: the "Trade by HS6 product" page, country-byhs6product.aspx, which lists
  every code under its chapter heading ("01 - Animals; live").
- hs6 names: the website's product search list, Scripts/hs6productlist.js. The page above shows
  WITS's short labels instead, cut at about 47 characters ("Live fowls of species Gallus
  domesticus, weighi"); the search list has the complete name for the same code ("Poultry; live,
  fowls of the species gallus domesticus, weighing not more than 185g").
- hs4 names: each heading's product page (.../product/0105, "HS Code 0105: ..."); the website
  has no list of headings. Chapter pages (.../product/01) are fetched too, to check the hs2 names.
- WITS API, /API/V1/wits/datasource/trn/product/all: every hs6 code must be one it serves.

Names are copied verbatim, with one exception: the hs6 page shows apostrophes doubled ("frogs''
legs", a quote-escaping bug in WITS); the product pages and WITS's own data have one, so '' is
stored as '. After writing, the script loads the SQL into SQLite and compares every row with
what was fetched, so the files never silently differ from the website.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import re
import sqlite3
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "reference" / "hs"

SITE = "https://wits.worldbank.org"
HS6_PAGE = f"{SITE}/trade/country-byhs6product.aspx?lang=en"
SEARCH_LIST = f"{SITE}/Scripts/hs6productlist.js"
PRODUCT_PAGE = (
    f"{SITE}/trade/comtrade/en/country/ALL/year/2025/tradeflow/Exports/partner/WLD/product/{{code}}"
)
API_PRODUCTS = f"{SITE}/API/V1/wits/datasource/trn/product/all"
WITS_NS = {"wits": "http://wits.worldbank.org"}

CHAPTER = re.compile(r'<h2 class="headingUnstyled">(\d{2}) - (.*?)</h2>')
PRODUCT_LINK = re.compile(r'href="[^"]*/product/(\d{6})"')
SEARCH_ITEM = re.compile(r'\{value:"(\w{6})",Name:"\1 -- ([^"\\]*)"\}')

BATCH = 500  # rows per INSERT statement


# ---------------------------------------------------------------- fetching
def download(session: requests.Session, url: str, tries: int = 4) -> str:
    """GET `url` and return the body as text, retrying with backoff on errors."""
    for attempt in range(tries):
        try:
            r = session.get(url, timeout=120)
            r.raise_for_status()
            r.encoding = "utf-8"
            return r.text.lstrip("\ufeff")
        except requests.RequestException:
            if attempt == tries - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def site_text(raw: str) -> str:
    """Website text as stored: HTML entities decoded, WITS's doubled apostrophes made single."""
    return html.unescape(raw).replace("''", "'")


def hs6_page(page: str) -> tuple[dict[str, str], list[str]]:
    """({hs2: chapter name}, [hs6 codes]) from the hs6 page, checking every code sits under its
    own chapter."""
    parts = CHAPTER.split(page)  # [before, hs2, name, section, hs2, name, section, ...]
    chapters: dict[str, str] = {}
    codes: list[str] = []
    for i in range(1, len(parts), 3):
        hs2, name, section = parts[i], parts[i + 1], parts[i + 2]
        found = PRODUCT_LINK.findall(section)
        if not found or any(c[:2] != hs2 for c in found) or hs2 in chapters:
            raise ValueError(f"{HS6_PAGE}: chapter {hs2} has codes {found[:5]}...")
        chapters[hs2] = site_text(name)
        codes += found
    if len(codes) != len(set(codes)):
        raise ValueError(f"{HS6_PAGE}: a code is listed twice")
    return chapters, codes


def search_names(js: str) -> dict[str, str]:
    """{hs6: name} from the website's product search list, checking no entry was skipped."""
    names = dict(SEARCH_ITEM.findall(js))
    if len(names) != js.count("{value:"):
        raise ValueError(f"{SEARCH_LIST}: parsed {len(names)} of {js.count('{value:')} entries")
    return names


def product_name(session: requests.Session, code: str) -> str:
    """The name a product page gives `code`, read from two places on the page that must agree."""
    url = PRODUCT_PAGE.format(code=code)
    page = download(session, url)
    label = re.search(rf"HS Code {code}: (.*?)</br>", page)
    h1 = re.search(r"<h1>(.*?) exports by country</h1>", page)
    if not label or not h1 or label.group(1) != h1.group(1):
        raise ValueError(f"{url}: no product name, or the page gives two different ones")
    return site_text(label.group(1))


def api_codes(session: requests.Session) -> set[str]:
    """Every HS6 code the WITS API serves (all revisions merged)."""
    root = ET.fromstring(download(session, API_PRODUCTS))
    return {p.get("productcode") for p in root.iterfind(".//wits:product", WITS_NS)}


# ---------------------------------------------------------------- rows
def build_rows(
    session: requests.Session, workers: int
) -> tuple[list[tuple], list[tuple], list[tuple]]:
    """Fetch everything and return hs2, hs4 and hs6 rows, checking each code against the other
    sources."""
    chapters, codes = hs6_page(download(session, HS6_PAGE))
    names = search_names(download(session, SEARCH_LIST))
    missing = [c for c in codes if c not in names]
    if missing:
        raise ValueError(f"{len(missing)} hs6 codes have no name in {SEARCH_LIST}: {missing[:10]}")
    not_served = sorted(set(codes) - api_codes(session))
    if not_served:
        raise ValueError(
            f"{len(not_served)} hs6 codes are not served by the API: {not_served[:10]}"
        )

    headings = sorted({c[:4] for c in codes})
    print(f"fetching {len(headings)} heading and {len(chapters)} chapter pages ...")
    with ThreadPoolExecutor(workers) as pool:
        fetched = pool.map(lambda c: product_name(session, c), headings + sorted(chapters))
        page_names = dict(zip(headings + sorted(chapters), fetched, strict=True))
    differ = [(c, n, page_names[c]) for c, n in chapters.items() if page_names[c] != n]
    if differ:
        raise ValueError(f"chapter names differ between the hs6 page and chapter pages: {differ}")

    hs2 = sorted(chapters.items())
    hs4 = [(c, c[:2], page_names[c]) for c in headings]
    hs6 = [(c, c[:4], names[c]) for c in sorted(codes)]
    unused = sorted(set(names) - set(codes))
    print(
        f"{len(hs2)} hs2, {len(hs4)} hs4, {len(hs6)} hs6 rows "
        f"({len(unused)} search-list codes not on the hs6 page left out: {unused})"
    )
    return hs2, hs4, hs6


# ---------------------------------------------------------------- SQL
def header() -> str:
    """Comment block at the top of every generated file."""
    return (
        f"-- Generated by backend/scripts/fetch_hs_codes.py on {dt.date.today().isoformat()}. Do not edit by hand.\n"
        f"-- Source: World Bank WITS website, HS 1988/92 (H0) codes. hs6 codes and hs2 names: {HS6_PAGE};\n"
        f"-- hs6 names: {SEARCH_LIST}; hs4 names: each heading's product page, {PRODUCT_PAGE}.\n"
        "-- Names are as the website shows them, except that its doubled apostrophes ('') are stored as one.\n"
        "-- Encoding: UTF-8. Portable SQL (SQLite and PostgreSQL).\n\n"
    )


def schema_sql(prefix: str = "") -> str:
    """DDL for the three tables. Codes are full prefixes (hs4_code = '0101', not '01') so each
    key stands alone and matches the 6-digit `hs6` strings used elsewhere in the code. `prefix`
    names a second set of tables in the same layout (e.g. "comtrade_")."""
    p = prefix
    return f"""DROP TABLE IF EXISTS {p}hs6;
DROP TABLE IF EXISTS {p}hs4;
DROP TABLE IF EXISTS {p}hs2;

-- Chapters: digits 1-2, e.g. 01 "Animals; live".
CREATE TABLE {p}hs2 (
    hs2_code CHAR(2) NOT NULL PRIMARY KEY,
    name     TEXT    NOT NULL,
    CHECK (length(hs2_code) = 2)
);

-- Headings: digits 3-4 within a chapter, e.g. 0105 "Poultry; live, fowls of the species ...".
CREATE TABLE {p}hs4 (
    hs4_code CHAR(4) NOT NULL PRIMARY KEY,
    hs2_code CHAR(2) NOT NULL REFERENCES {p}hs2 (hs2_code),
    name     TEXT    NOT NULL,
    CHECK (length(hs4_code) = 4),
    CHECK (hs2_code = substr(hs4_code, 1, 2))
);
CREATE INDEX ix_{p}hs4_hs2_code ON {p}hs4 (hs2_code);

-- Subheadings: digits 5-6 within a heading, e.g. 010511 "Poultry; live, fowls of the species
-- gallus domesticus, weighing not more than 185g".
CREATE TABLE {p}hs6 (
    hs6_code CHAR(6) NOT NULL PRIMARY KEY,
    hs4_code CHAR(4) NOT NULL REFERENCES {p}hs4 (hs4_code),
    name     TEXT    NOT NULL,
    CHECK (length(hs6_code) = 6),
    CHECK (hs4_code = substr(hs6_code, 1, 4))
);
CREATE INDEX ix_{p}hs6_hs4_code ON {p}hs6 (hs4_code);
"""


def sql_str(value: str) -> str:
    """A single-quoted SQL string literal."""
    return "'" + value.replace("'", "''") + "'"


def inserts_sql(table: str, columns: list[str], rows: list[tuple]) -> str:
    """Multi-row INSERTs in batches of BATCH, wrapped in one transaction."""
    parts = ["BEGIN;\n"]
    for i in range(0, len(rows), BATCH):
        values = ",\n".join(
            "(" + ", ".join(sql_str(v) for v in row) + ")" for row in rows[i : i + BATCH]
        )
        parts.append(f"INSERT INTO {table} ({', '.join(columns)}) VALUES\n{values};\n")
    parts.append("COMMIT;\n")
    return "".join(parts)


def load_sqlite(db: str | Path, sql_files: list[Path], expected: dict[str, list[tuple]]) -> None:
    """Run the SQL files, in order, against the SQLite database `db` with foreign keys enforced,
    then fail unless every table holds exactly the `expected` rows."""
    con = sqlite3.connect(db)
    try:
        con.execute("PRAGMA foreign_keys = ON")
        for path in sql_files:
            con.executescript(path.read_text(encoding="utf-8"))
        broken = con.execute("PRAGMA foreign_key_check").fetchall()
        if broken:
            raise RuntimeError(f"{db}: {len(broken)} foreign key violations, e.g. {broken[:5]}")
        for table, rows in expected.items():
            got = con.execute(f"SELECT * FROM {table} ORDER BY 1").fetchall()
            if got != rows:
                bad = [(g, e) for g, e in zip(got, rows, strict=False) if g != e][:3]
                raise RuntimeError(f"{db}: {table} differs from the source, e.g. {bad}")
    finally:
        con.close()
    print(
        f"checked {db}: " + ", ".join(f"{len(r)} {t}" for t, r in expected.items()) + " rows match"
    )


def main() -> int:
    """Fetch the website's codes and names, write SQL, check it reproduces them, and with --db
    load it into a SQLite database."""
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--db", type=Path, help="also (re)create the tables in this SQLite database")
    ap.add_argument("--workers", type=int, default=4, help="product pages fetched at once")
    a = ap.parse_args()

    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 (fetch_hs_codes.py)"
    hs2, hs4, hs6 = build_rows(session, a.workers)

    a.out.mkdir(parents=True, exist_ok=True)
    files = {
        "00_schema.sql": schema_sql(),
        "01_hs2.sql": inserts_sql("hs2", ["hs2_code", "name"], hs2),
        "02_hs4.sql": inserts_sql("hs4", ["hs4_code", "hs2_code", "name"], hs4),
        "03_hs6.sql": inserts_sql("hs6", ["hs6_code", "hs4_code", "name"], hs6),
    }
    for name, body in files.items():
        (a.out / name).write_text(header() + body, encoding="utf-8")
        print("wrote", a.out / name)

    paths = [a.out / name for name in files]
    expected = {"hs2": hs2, "hs4": hs4, "hs6": hs6}
    load_sqlite(":memory:", paths, expected)
    if a.db:
        load_sqlite(a.db, paths, expected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
