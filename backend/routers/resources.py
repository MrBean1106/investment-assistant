"""Policies & Properties CRUD API router."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Policy, Property
from schemas import PolicyCreate, PolicyResponse, PropertyCreate, PropertyResponse

policies_router = APIRouter()
properties_router = APIRouter()


# ── Policies ──────────────────────────────────
@policies_router.get("/", response_model=list[PolicyResponse])
def list_policies(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Policy)
    if search:
        query = query.filter(Policy.title.ilike(f"%{search}%"))
    return [PolicyResponse.model_validate(p) for p in query.all()]


@policies_router.post("/", response_model=PolicyResponse, status_code=201)
def create_policy(data: PolicyCreate, db: Session = Depends(get_db)):
    policy = Policy(**data.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return PolicyResponse.model_validate(policy)


@policies_router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(policy_id: int, data: PolicyCreate, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(policy, key, value)
    db.commit()
    db.refresh(policy)
    return PolicyResponse.model_validate(policy)


@policies_router.delete("/{policy_id}", status_code=204)
def delete_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(policy)
    db.commit()


# ── Properties ────────────────────────────────
@properties_router.get("/", response_model=list[PropertyResponse])
def list_properties(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Property)
    if search:
        query = query.filter(Property.name.ilike(f"%{search}%"))
    return [PropertyResponse.model_validate(p) for p in query.all()]


@properties_router.post("/", response_model=PropertyResponse, status_code=201)
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(**data.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return PropertyResponse.model_validate(prop)


@properties_router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: int, data: PropertyCreate, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(prop, key, value)
    db.commit()
    db.refresh(prop)
    return PropertyResponse.model_validate(prop)


@properties_router.delete("/{property_id}", status_code=204)
def delete_property(property_id: int, db: Session = Depends(get_db)):
    prop = db.query(Property).filter(Property.id == property_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(prop)
    db.commit()
