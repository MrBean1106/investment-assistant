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
        return "", False, f"OCR 超时（>{_WORKER_TIMEOUT}s）"
    except Exception as e:  # pragma: no cover - defensive
        return "", False, f"OCR 子进程启动失败: {e}"

    if proc.returncode != 0 and not proc.stdout.strip():
        err = proc.stderr.strip() or f"worker exit {proc.returncode}"
        return "", False, f"OCR 失败: {err[:300]}"

    try:
        out = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return "", False, f"OCR 输出解析失败: {proc.stdout[:200]}"

    if out.get("error"):
        return "", False, str(out["error"])
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
