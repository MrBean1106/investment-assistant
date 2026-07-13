"""Dashboard statistics endpoint.

Returns aggregated counts so the frontend dashboard doesn't have to
count items client-side (which was buggy — it only counted the first
page of enterprises returned by the list endpoint).
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Enterprise, Policy, Property, Report

router = APIRouter()


def _group_counts(db: Session, model, column):
    """Return {value: count} grouped by a column, skipping NULLs."""
    rows = db.query(getattr(model, column), func.count(model.id)).filter(
        getattr(model, column).isnot(None)
    ).group_by(getattr(model, column)).all()
    return {str(row[0]) if row[0] is not None else "未分类": row[1] for row in rows}


@router.get("/")
def dashboard_stats(db: Session = Depends(get_db)):
    total = db.query(Enterprise).count()

    by_status = _group_counts(db, Enterprise, "status")
    by_industry = _group_counts(db, Enterprise, "industry")
    by_region = _group_counts(db, Enterprise, "region")
    by_rating = _group_counts(db, Enterprise, "invest_rating")
    by_scale = _group_counts(db, Enterprise, "scale")

    # Funnel ordering
    funnel_order = ["线索", "洽谈中", "已签约", "已落地"]
    funnel = [{"stage": s, "count": by_status.get(s, 0)} for s in funnel_order]

    signed_or_landed = by_status.get("已签约", 0) + by_status.get("已落地", 0)
    conversion_rate = round(signed_or_landed / total * 100, 1) if total else 0.0

    total_policies = db.query(Policy).count()
    total_properties = db.query(Property).count()
    total_reports = db.query(Report).count()

    # Recent enterprises (latest 6)
    recent = db.query(Enterprise).order_by(
        Enterprise.updated_at.desc().nullslast()
    ).limit(6).all()
    recent_list = [
        {
            "id": e.id,
            "name": e.name,
            "industry": e.industry,
            "status": e.status,
            "invest_rating": e.invest_rating,
            "region": e.region,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in recent
    ]

    return {
        "total_enterprises": total,
        "by_status": by_status,
        "by_industry": by_industry,
        "by_region": by_region,
        "by_rating": by_rating,
        "by_scale": by_scale,
        "funnel": funnel,
        "conversion_rate": conversion_rate,
        "signed_or_landed": signed_or_landed,
        "total_policies": total_policies,
        "total_properties": total_properties,
        "total_reports": total_reports,
        "recent_enterprises": recent_list,
    }
