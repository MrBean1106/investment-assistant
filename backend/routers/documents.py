"""Documents API — list and delete parsed uploads stored in the DB."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import Document

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

    model_config = {"from_attributes": True}


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
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
        )
        for d in docs
    ]


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
