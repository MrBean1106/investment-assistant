"""AI-powered endpoints: profile generation, resource matching, report generation."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Enterprise, Policy, Property, Report
from services import generate_profile, match_resources, generate_report

router = APIRouter()


def _ent_to_dict(ent: Enterprise) -> dict:
    return {
        "id": ent.id,
        "name": ent.name,
        "industry": ent.industry,
        "segment": ent.segment or "",
        "region": ent.region or "",
        "scale": ent.scale or "",
        "status": ent.status or "",
        "contact": ent.contact or "",
        "demand": ent.demand or "",
        "invest_rating": ent.invest_rating or "",
        "tags": ent.tags or [],
        "pain_points": ent.pain_points,
    }


@router.post("/generate-profile/{enterprise_id}")
def api_generate_profile(enterprise_id: int, db: Session = Depends(get_db)):
    """Generate enterprise profile analysis via AI (with rule-based fallback)."""
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    result = generate_profile(_ent_to_dict(ent))

    # Save to database
    ent.pain_points = result.get("pain_points")
    ent.needs = result.get("investment_analysis")
    ent.analysis_text = result.get("summary")
    db.commit()

    return {"enterprise_id": enterprise_id, "profile": result}


@router.post("/match-policies/{enterprise_id}")
def api_match_policies(enterprise_id: int, db: Session = Depends(get_db)):
    """Match enterprise with applicable policies."""
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    policies = db.query(Policy).all()
    policy_dicts = [
        {"id": p.id, "title": p.title, "level": p.level, "category": p.category,
         "scope": p.scope, "benefit": p.benefit, "match_tags": p.match_tags or []}
        for p in policies
    ]

    result = match_resources(_ent_to_dict(ent), policy_dicts, "政策")
    return {"enterprise_id": enterprise_id, "matches": result}


@router.post("/match-properties/{enterprise_id}")
def api_match_properties(enterprise_id: int, db: Session = Depends(get_db)):
    """Match enterprise with available properties."""
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    properties = db.query(Property).all()
    prop_dicts = [
        {"id": p.id, "name": p.name, "type": p.type, "area": p.area,
         "price": p.price, "location": p.location, "features": p.features, "tags": p.tags or []}
        for p in properties
    ]

    result = match_resources(_ent_to_dict(ent), prop_dicts, "物业")
    return {"enterprise_id": enterprise_id, "matches": result}


@router.post("/generate-report/{enterprise_id}")
def api_generate_report(enterprise_id: int, db: Session = Depends(get_db)):
    """Generate investment assessment report."""
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    ent_dict = _ent_to_dict(ent)
    profile = ent.pain_points or {}
    matches = {"summary": "匹配结果待生成"}

    # Try to get real matches
    try:
        policies = db.query(Policy).all()
        policy_dicts = [{"id": p.id, "title": p.title, "match_tags": p.match_tags or []} for p in policies]
        policy_matches = match_resources(ent_dict, policy_dicts, "政策")
        matches["policy_matches"] = policy_matches
        matches["summary"] = policy_matches.get("summary", "")
    except Exception:
        pass

    report = generate_report(ent_dict, profile, matches)

    # Save report to DB
    db_report = Report(
        enterprise_id=enterprise_id,
        type="投资研判",
        title=report.get("title", f"{ent.name} 招商研判报告"),
        content=report,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return {"report_id": db_report.id, "report": report}
