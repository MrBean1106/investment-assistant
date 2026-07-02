"""Reports API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Report

router = APIRouter()


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
