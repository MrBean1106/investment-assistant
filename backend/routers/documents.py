"""Documents API — list, download and delete parsed uploads stored in the DB.

Documents may be linked to an enterprise (过程文件附件) via `enterprise_id`,
or be free-standing uploads used as AI chat context.
"""

from pathlib import Path
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from database import get_db
from models import Document

UPLOAD_DIR = Path("uploads")

router = APIRouter()


class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_type: str
    ext: str | None = None
    ocr_used: bool
    ocr_engine: str | None = None
    size: int
    content_preview: str
    created_at: datetime | None = None
    enterprise_id: int | None = None
    note: str | None = None

    model_config = {"from_attributes": True}


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    enterprise_id: Optional[int] = Query(None, description="按企业过滤附件"),
    db: Session = Depends(get_db),
):
    q = db.query(Document)
    if enterprise_id is not None:
        q = q.filter(Document.enterprise_id == enterprise_id)
    q = q.order_by(Document.created_at.desc())
    docs = q.all()
    return [
        DocumentResponse(
            id=d.id,
            filename=d.filename,
            file_type=d.file_type,
            ext=d.ext,
            ocr_used=d.ocr_used,
            ocr_engine=d.ocr_engine,
            size=d.size,
            content_preview=(d.content or "")[:200],
            created_at=d.created_at,
            enterprise_id=d.enterprise_id,
            note=d.note,
        )
        for d in docs
    ]


@router.get("/{doc_id}/download")
def download_document(doc_id: int, db: Session = Depends(get_db)):
    """Return the original file for download. Falls back to extracted text."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # 优先返回磁盘原始文件
    if doc.stored_name:
        path = UPLOAD_DIR / doc.stored_name
        if path.exists():
            media = _media_for_ext(doc.ext or "")
            return FileResponse(str(path), media_type=media, filename=doc.filename or doc.stored_name)

    # 无原文件（旧记录）则回退为文本下载
    text = doc.content or ""
    ascii_name = (doc.filename or "document").encode("ascii", "ignore").decode() or "document"
    return Response(
        content=text.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(doc.filename or 'document.txt')}; filename={ascii_name}.txt"},
    )


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # 一并删除磁盘原始文件
    if doc.stored_name:
        p = UPLOAD_DIR / doc.stored_name
        if p.exists():
            try:
                p.unlink()
            except OSError:
                pass
    db.delete(doc)
    db.commit()


def _media_for_ext(ext: str) -> str:
    ext = (ext or "").lower()
    if ext == ".pdf":
        return "application/pdf"
    if ext == ".png":
        return "image/png"
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".gif":
        return "image/gif"
    if ext == ".webp":
        return "image/webp"
    if ext == ".bmp":
        return "image/bmp"
    if ext in (".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml"):
        return "text/plain"
    if ext in (".html", ".htm"):
        return "text/html"
    if ext == ".css":
        return "text/css"
    return "application/octet-stream"
