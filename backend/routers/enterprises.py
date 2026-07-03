"""Enterprise CRUD API router."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Enterprise
from schemas.enterprise import (
    EnterpriseCreate,
    EnterpriseUpdate,
    EnterpriseResponse,
    EnterpriseListResponse,
)

router = APIRouter(redirect_slashes=False)


@router.get("/", response_model=EnterpriseListResponse)
def list_enterprises(
    search: Optional[str] = Query(None, description="Search by name, industry, segment"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Enterprise)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Enterprise.name.ilike(like))
            | (Enterprise.industry.ilike(like))
            | (Enterprise.segment.ilike(like))
        )
    if status:
        query = query.filter(Enterprise.status == status)
    total = query.count()
    items = query.order_by(Enterprise.updated_at.desc()).offset(skip).limit(limit).all()
    return EnterpriseListResponse(
        items=[EnterpriseResponse.model_validate(e) for e in items],
        total=total,
    )


@router.get("/{enterprise_id}", response_model=EnterpriseResponse)
def get_enterprise(enterprise_id: int, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    return EnterpriseResponse.model_validate(ent)


@router.post("/", response_model=EnterpriseResponse, status_code=201)
def create_enterprise(data: EnterpriseCreate, db: Session = Depends(get_db)):
    ent = Enterprise(**data.model_dump())
    db.add(ent)
    db.commit()
    db.refresh(ent)
    return EnterpriseResponse.model_validate(ent)


@router.put("/{enterprise_id}", response_model=EnterpriseResponse)
def update_enterprise(enterprise_id: int, data: EnterpriseUpdate, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ent, key, value)
    db.commit()
    db.refresh(ent)
    return EnterpriseResponse.model_validate(ent)


@router.delete("/{enterprise_id}", status_code=204)
def delete_enterprise(enterprise_id: int, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")
    db.delete(ent)
    db.commit()
