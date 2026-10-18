"""FastAPI app (plan.md Phase 5): upload a PDF, get a `Report`; cached reports; bundled samples."""

import csv
import logging
import os
import re
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from tbml.benchmark import band_file, benchmarks_are_mock, database_enabled, describe_source, shards
from tbml.classify import describe_classifier
from tbml.classify.nomenclature import default_nomenclature
from tbml.llm import describe_provider
from tbml.paths import REPORTS_DIR, SYNTHETIC_DIR
from tbml.pipeline import check as run_check
from tbml.pipeline import use_mocks
from tbml.schemas import SCHEMA_VERSION, Report

log = logging.getLogger("tbml.api")

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
_SAFE_ID = re.compile(r"[^A-Za-z0-9._-]")

app = FastAPI(title="TBML Invoice Checker", version=SCHEMA_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _reports_dir() -> Path:
    return Path(os.environ.get("TBML_REPORTS_DIR") or REPORTS_DIR)


def _report_path(invoice_id: str) -> Path:
    return _reports_dir() / f"{_SAFE_ID.sub('_', invoice_id)}.json"


def _save(report: Report) -> None:
    try:
        path = _report_path(report.invoice_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(report.model_dump_json(indent=2))
    except OSError as exc:  # the report is still returned; only the cache is lost
        log.warning("could not cache report %s: %s", report.invoice_id, exc)


def _check_bytes(data: bytes, filename: str) -> Report:
    if not data.startswith(b"%PDF"):
        raise HTTPException(400, "Please upload a PDF file (the file does not look like a PDF).")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / (_SAFE_ID.sub("_", Path(filename).name) or "upload.pdf")
        path.write_bytes(data)
        try:
            report = run_check(path)
        except Exception as exc:  # unreadable/corrupt PDF: a client problem, never a 500
            log.exception("check failed for %s", filename)
            raise HTTPException(
                400, f"The PDF could not be read ({type(exc).__name__}). Is it corrupted?"
            ) from exc
    _save(report)
    return report


@app.get("/health")
def health() -> dict[str, str | bool]:
    mocks = use_mocks()
    return {
        "status": "ok",
        "schema_version": SCHEMA_VERSION,
        "stubs": mocks,
        "benchmarks": "mock" if mocks or benchmarks_are_mock() else "real",
        "llm": describe_provider(),  # chat model, e.g. "openrouter:<model>" or "offline"
        "classifier": describe_classifier(),  # e.g. "jev:typesafe/jev-1.14" or "keyword"
        "bands": band_file(),
        "price_data": describe_source(),  # "database:<n> shards" or the band file name
        "price_period": _price_period(),  # "202307-202608": months the database prices cover
        "commit": os.environ.get("VERCEL_GIT_COMMIT_SHA", "")[:7] or "local",
    }


def _price_period() -> str:
    if not database_enabled():
        return ""
    info = shards.build_info()
    first, last = info.get("data_first_period", ""), info.get("data_last_period", "")
    return f"{first}-{last}" if first and last else ""


@app.post("/check")
def check(file: UploadFile) -> Report:
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large: the limit is 10 MB.")
    return _check_bytes(data, file.filename or "upload.pdf")


@app.get("/reports/{invoice_id}")
def get_report(invoice_id: str) -> Report:
    path = _report_path(invoice_id)
    if not path.is_file():
        raise HTTPException(404, f"No report for invoice {invoice_id}.")
    return Report.model_validate_json(path.read_text())


def _samples() -> list[dict[str, str | int | list[str]]]:
    path = SYNTHETIC_DIR / "invoices.csv"
    if not path.is_file():
        return []
    with open(path, newline="") as f:
        rows = list(csv.DictReader(f))
    return [
        {
            "invoice_id": r["invoice_id"],
            "file": f"{r['invoice_id']}.pdf",
            "kind": r["role"],
            "planted": [x for x in r["labels"].split(";") if x],
            "template": r["template"],
            "route": r["route"],
            "currency": r["currency"],
            "n_lines": int(r["n_lines"]),
        }
        for r in rows
        if (SYNTHETIC_DIR / "pdfs" / f"{r['invoice_id']}.pdf").is_file()
    ]


@app.get("/samples")
def samples() -> list[dict[str, str | int | list[str]]]:
    """Bundled synthetic invoices (`kind` = clean | anomalous | hard_negative, `planted` = the labels)."""
    return _samples()


@app.post("/samples/{invoice_id}/check")
def check_sample(invoice_id: str) -> Report:
    if invoice_id not in {s["invoice_id"] for s in _samples()}:
        raise HTTPException(404, f"No sample invoice {invoice_id}.")
    pdf = SYNTHETIC_DIR / "pdfs" / f"{invoice_id}.pdf"
    return _check_bytes(pdf.read_bytes(), pdf.name)


@app.get("/samples/{invoice_id}/pdf")
def sample_pdf(invoice_id: str) -> FileResponse:
    """The sample invoice itself, so the checker can show the document it analysed."""
    if invoice_id not in {s["invoice_id"] for s in _samples()}:
        raise HTTPException(404, f"No sample invoice {invoice_id}.")
    return FileResponse(
        SYNTHETIC_DIR / "pdfs" / f"{invoice_id}.pdf",
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice_id}.pdf"'},
    )


_HS6 = re.compile(r"^\d{6}$")


@app.get("/hs")
def hs_codes(codes: str = Query(..., max_length=700)) -> dict[str, dict[str, object]]:
    """Reference lookup for HS6 codes (comma-separated, at most 100): the chapter, heading and
    subheading names, and the CN8 codes HMRC lists under each. Read-only; the classifier is not
    involved."""
    wanted = list(dict.fromkeys(c.strip() for c in codes.split(",") if c.strip()))
    if not wanted or len(wanted) > 100 or not all(_HS6.match(c) for c in wanted):
        raise HTTPException(400, "Pass up to 100 six-digit HS codes, comma-separated.")
    names = default_nomenclature()
    out: dict[str, dict[str, object]] = {}
    for code in wanted:
        cn8 = shards.cn8_codes(code) if database_enabled() else ()
        out[code] = {
            "chapter": {"code": code[:2], "description": names.describe(code[:2])},
            "heading": {"code": code[:4], "description": names.describe(code[:4])},
            "subheading": {"code": code, "description": names.describe(code)},
            "cn8": [{"code": c, "description": d} for c, d in cn8],
        }
    return out


@app.exception_handler(Exception)
async def unexpected(_request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error")
    return JSONResponse({"detail": f"Internal error ({type(exc).__name__})."}, status_code=500)
