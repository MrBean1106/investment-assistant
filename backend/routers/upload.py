"""File upload endpoint for AI chat context, with OCR for scanned files."""

import base64
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

from database import SessionLocal
from models import Document
from services.ocr import ocr_bytes, engine_name

router = APIRouter()

ALLOWED_TEXT = {'.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.html', '.css', '.log', '.xml', '.yaml', '.yml'}
ALLOWED_IMAGE = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

OCR_ENGINE = engine_name()


def _persist(filename, file_type, ext, content, ocr_used, size) -> int | None:
    """Store the parsed upload in the documents table. Returns the row id."""
    try:
        db = SessionLocal()
        doc = Document(
            filename=filename,
            file_type=file_type,
            ext=ext,
            content=content,
            ocr_used=ocr_used,
            ocr_engine=OCR_ENGINE if ocr_used else None,
            size=size,
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = doc.id
        db.close()
        return doc_id
    except Exception:
        # Persistence failure must not break the upload response.
        return None


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        filename = file.filename or "unknown"
        ext = Path(filename).suffix.lower()
        file_type = "unknown"
        content = ""
        image_base64 = ""
        ocr_used = False

        if ext in ALLOWED_TEXT:
            file_type = "text"
            content = raw.decode('utf-8', errors='replace')

        elif ext in ALLOWED_IMAGE:
            file_type = "image"
            safe_name = Path(filename).name
            (UPLOAD_DIR / safe_name).write_bytes(raw)
            image_base64 = base64.b64encode(raw).decode()
            # OCR so text-only LLMs (e.g. DeepSeek) can read the image.
            text, used, err = ocr_bytes(raw, ext)
            if err:
                content = f"[图片: {safe_name}]（OCR 失败: {err}）"
            elif text:
                content = text
                ocr_used = used
            else:
                content = f"[图片: {safe_name}]（OCR 未识别出文字）"

        elif ext == '.pdf':
            file_type = "pdf"
            try:
                text, ocr_used, err = ocr_bytes(raw, ext)
                if err:
                    content = f"[PDF 解析失败: {err}]"
                else:
                    content = text
                    if not content:
                        content = "[PDF 未提取到任何文本（OCR 也未能识别，可能是空白或加密文件）]"
            except Exception as e:
                content = f"[PDF 解析失败: {e}]"

        else:
            content = f"[不支持的文件类型: {ext}]"

        # PDF / OCR 文本较长，放宽截断上限；其余类型保持 5000
        cap = 8000 if (file_type == "pdf" or ocr_used) else 5000
        doc_id = _persist(filename, file_type, ext, content[:cap], ocr_used, len(raw))

        return JSONResponse({
            "filename": filename,
            "file_type": file_type,
            "content": content[:cap],
            "image_base64": image_base64,
            "ocr_used": ocr_used,
            "ocr_engine": OCR_ENGINE if ocr_used else None,
            "document_id": doc_id,
            "size": len(raw),
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
