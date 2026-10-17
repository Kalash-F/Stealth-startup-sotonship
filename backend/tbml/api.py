"""FastAPI app. Phase 0: health + a stub /check so the frontend can develop against it."""

import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from tbml.pipeline import check as run_check
from tbml.schemas import SCHEMA_VERSION, Report

app = FastAPI(title="TBML Invoice Checker", version=SCHEMA_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"status": "ok", "schema_version": SCHEMA_VERSION, "stubs": True, "benchmarks": "mock"}


@app.post("/check")
async def check(file: UploadFile) -> Report:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / Path(file.filename or "upload.pdf").name
        path.write_bytes(await file.read())
        return run_check(path)
