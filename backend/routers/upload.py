"""File upload endpoint for AI chat context."""

import base64
from pathlib import Path
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import JSONResponse

router = APIRouter()

ALLOWED_TEXT = {'.txt', '.md', '.csv', '.json', '.py', '.js', '.ts', '.html', '.css', '.log', '.xml', '.yaml', '.yml'}
ALLOWED_IMAGE = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'}

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        raw = await file.read()
        filename = file.filename or "unknown"
        ext = Path(filename).suffix.lower()
        file_type = "unknown"
        content = ""
        image_base64 = ""

        if ext in ALLOWED_TEXT:
            file_type = "text"
            content = raw.decode('utf-8', errors='replace')

        elif ext in ALLOWED_IMAGE:
            file_type = "image"
            safe_name = Path(filename).name
            (UPLOAD_DIR / safe_name).write_bytes(raw)
            image_base64 = base64.b64encode(raw).decode()
            content = f"[图片: {safe_name}]"

        elif ext == '.pdf':
            file_type = "pdf"
            try:
                import fitz
                doc = fitz.open(stream=raw, filetype="pdf")
                content = "\n".join(page.get_text() for page in doc)
            except ImportError:
                content = "[PDF 解析需要 pymupdf 库]"

        else:
            content = f"[不支持的文件类型: {ext}]"

        return JSONResponse({
            "filename": filename,
            "file_type": file_type,
            "content": content[:5000],
            "image_base64": image_base64,
            "size": len(raw),
        })
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
