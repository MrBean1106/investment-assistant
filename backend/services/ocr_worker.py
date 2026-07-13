"""OCR worker — runs RapidOCR in an isolated process.

This module is executed as a separate Python process (see services/ocr.py).
Keeping RapidOCR/onnxruntime/opencv inside a child process means a native
crash can never take down the API server (and it stays safe under
`uvicorn --reload` on Windows, where the reloader spawns subprocesses that
otherwise segfault on these native libs).
"""

import sys
import json
import fitz  # pymupdf

# Hardening for native libs (must precede onnxruntime import).
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("ONNXRUNTIME_DISABLE_THREAD_SPINNING", "1")

from rapidocr_onnxruntime import RapidOCR

ENGINE = RapidOCR()


def _result_to_text(result):
    if not result:
        return ""
    lines = []
    for item in result:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            text = str(item[1]).strip()
            if text:
                lines.append(text)
    return "\n".join(lines).strip()


def ocr_image_file(path: str) -> str:
    result, _ = ENGINE(path)
    return _result_to_text(result)


def ocr_pdf_file(path: str, dpi: int = 200):
    doc = fitz.open(path)
    used_ocr = False
    pages_text = []
    try:
        for page in doc:
            text = page.get_text().strip()
            if text:
                pages_text.append(text)
                continue
            used_ocr = True
            try:
                pix = page.get_pixmap(dpi=dpi)
                tmp = path + f".page{page.number}.png"
                pix.save(tmp)
                try:
                    pages_text.append(ocr_image_file(tmp))
                finally:
                    try:
                        os.unlink(tmp)
                    except OSError:
                        pass
            except Exception:
                pages_text.append("")
    finally:
        doc.close()
    return "\n".join(pages_text).strip(), used_ocr


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"text": "", "used_ocr": False, "error": "missing path"}))
        sys.exit(1)
    path = sys.argv[1]
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".pdf":
            text, used = ocr_pdf_file(path)
        else:
            text = ocr_image_file(path)
            used = True
        print(json.dumps({"text": text, "used_ocr": used}))
        sys.exit(0)
    except Exception as e:  # never crash the parent with a traceback
        print(json.dumps({"text": "", "used_ocr": False, "error": str(e)}))
        sys.exit(2)


if __name__ == "__main__":
    main()
