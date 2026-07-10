"""Reports API router."""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Literal
from urllib.parse import quote

from database import get_db
from models import Report
from services.report_export import render_report_pdf, render_report_docx

router = APIRouter()

_PDF_MEDIA = "application/pdf"
_DOCX_MEDIA = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


@router.get("/")
def list_reports(db: Session = Depends(get_db)):
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "enterprise_id": r.enterprise_id,
            "type": r.type,
            "title": r.title,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]


@router.get("/{report_id}")
def get_report(report_id: int, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "id": r.id,
        "enterprise_id": r.enterprise_id,
        "type": r.type,
        "title": r.title,
        "content": r.content,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/{report_id}/export")
def export_report(
    report_id: int,
    format: Literal["pdf", "docx"] = Query("pdf", description="导出格式：pdf 或 docx"),
    db: Session = Depends(get_db),
):
    """Export a stored report as a PDF or Word (.docx) document."""
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    content = r.content or {}
    safe_title = (r.title or "招商研判报告").replace("/", "_").replace("\\", "_")

    if format == "docx":
        data = render_report_docx(content)
        media = _DOCX_MEDIA
        ext = "docx"
    else:
        data = render_report_pdf(content)
        media = _PDF_MEDIA
        ext = "pdf"

    # RFC 5987: headers must be latin-1, so encode the UTF-8 filename separately.
    ascii_name = f"report_{report_id}.{ext}"
    disp = f"attachment; filename={ascii_name}; filename*=UTF-8''{quote(safe_title + '.' + ext)}"

    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": disp},
    )
