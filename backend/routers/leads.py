"""Lead (招商线索) CRUD API router."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from database import get_db
from models import Lead, Enterprise
from schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadListResponse,
    LeadFollowUp,
    LeadStatsResponse,
)

router = APIRouter(redirect_slashes=False)

STAGES = ["初步接触", "意向洽谈", "深度对接", "签约落地", "已落地", "已流失"]
ACTIVE_STAGES = ["初步接触", "意向洽谈", "深度对接", "签约落地"]


@router.get("/stats", response_model=LeadStatsResponse)
def lead_stats(db: Session = Depends(get_db)):
    leads = db.query(Lead).all()
    by_stage: dict[str, int] = {s: 0 for s in STAGES}
    for lead in leads:
        by_stage[lead.stage] = by_stage.get(lead.stage, 0) + 1
    active = sum(by_stage.get(s, 0) for s in ACTIVE_STAGES)
    return LeadStatsResponse(by_stage=by_stage, total=len(leads), active=active)


@router.get("/", response_model=LeadListResponse)
def list_leads(
    search: Optional[str] = Query(None, description="搜索企业名称/标题/负责人"),
    stage: Optional[str] = Query(None, description="按阶段筛选"),
    owner: Optional[str] = Query(None, description="按负责人筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(Lead)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Lead.company_name.ilike(like))
            | (Lead.title.ilike(like))
            | (Lead.owner.ilike(like))
        )
    if stage:
        query = query.filter(Lead.stage == stage)
    if owner:
        query = query.filter(Lead.owner == owner)
    total = query.count()
    items = query.order_by(Lead.updated_at.desc()).offset(skip).limit(limit).all()
    return LeadListResponse(
        items=[LeadResponse.model_validate(l) for l in items],
        total=total,
    )


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return LeadResponse.model_validate(lead)


@router.post("/", response_model=LeadResponse, status_code=201)
def create_lead(data: LeadCreate, db: Session = Depends(get_db)):
    lead = Lead(**data.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return LeadResponse.model_validate(lead)


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: int, data: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)
    db.commit()
    db.refresh(lead)
    return LeadResponse.model_validate(lead)


@router.post("/{lead_id}/follow-up", response_model=LeadResponse)
def add_follow_up(lead_id: int, body: LeadFollowUp, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    logs = list(lead.follow_ups or [])
    logs.append(
        {
            "date": date.today().isoformat(),
            "content": body.content,
            "owner": body.owner or lead.owner or "未指定",
        }
    )
    lead.follow_ups = logs
    db.commit()
    db.refresh(lead)
    return LeadResponse.model_validate(lead)


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
