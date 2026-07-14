"""OCR service for scanned PDFs and images.

Delegates the actual OCR to an isolated subprocess (services.ocr_worker)
so native libs (onnxruntime/opencv) can never crash the API server — this
keeps `uvicorn --reload` on Windows stable, where the reloader's spawned
subprocess would otherwise segfault on these libraries.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from typing import Tuple

OCR_ENGINE_NAME = "RapidOCR"
_WORKER_TIMEOUT = 180  # seconds, generous for multi-page scanned PDFs


def _ocr_in_process(path: str) -> Tuple[str, bool, str]:
    """Fallback in-process OCR when subprocess is unavailable or fails."""
    try:
        # Set env vars before importing native libs (same as ocr_worker)
        os.environ.setdefault("OMP_NUM_THREADS", "1")
        os.environ.setdefault("MKL_NUM_THREADS", "1")
        os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
        os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
        os.environ.setdefault("ONNXRUNTIME_DISABLE_THREAD_SPINNING", "1")

        from services.ocr_worker import ocr_image_file, ocr_pdf_file
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pdf":
            text, used = ocr_pdf_file(path)
        else:
            text = ocr_image_file(path)
            used = True
        return text, used, ""
    except Exception as e:
        return "", False, f"OCR 失败（in-process 回退）: {e}"


def _run_worker(path: str) -> Tuple[str, bool, str]:
    """Run the OCR worker on a file path. Returns (text, used_ocr, error)."""
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "services.ocr_worker", path],
            capture_output=True,
            text=True,
            timeout=_WORKER_TIMEOUT,
        )
    except subprocess.TimeoutExpired:
        # Timeout: try in-process as fallback
        return _ocr_in_process(path)
    except Exception as e:
        # Subprocess spawn failed (e.g., sandboxed environment). Fall back to in-process.
        return _ocr_in_process(path)

    if proc.returncode != 0 and not proc.stdout.strip():
        err = proc.stderr.strip() or f"worker exit {proc.returncode}"
        # Worker failed: try in-process as fallback before giving up
        return _ocr_in_process(path)

    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return _ocr_in_process(path)

    if out.get("error"):
        return _ocr_in_process(path)
    return out.get("text", ""), bool(out.get("used_ocr", False)), ""


def ocr_bytes(raw: bytes, ext: str) -> Tuple[str, bool, str]:
    """OCR raw file bytes. Returns (text, used_ocr, error).

    `ext` should include the leading dot, e.g. '.pdf', '.png'.
    """
    suffix = ext or ".bin"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(raw)
        tmp.close()
        return _run_worker(tmp.name)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def engine_name() -> str:
    return OCR_ENGINE_NAME
