"""Policies & Properties CRUD API router."""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from services.excel_io import rows_to_xlsx, xlsx_to_rows, XLSX_MEDIA
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Policy, Property
from schemas import PolicyCreate, PolicyUpdate, PolicyResponse, PropertyCreate, PropertyUpdate, PropertyResponse

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


POL_COLUMNS = [
    ("title", "政策标题"), ("level", "级别"), ("category", "类别"),
    ("scope", "适用范围"), ("benefit", "优惠内容"), ("match_tags", "标签(逗号分隔)"),
]


@policies_router.get("/export")
def export_policies(db: Session = Depends(get_db)):
    rows = []
    for p in db.query(Policy).order_by(Policy.id).all():
        d = {c[0]: (getattr(p, c[0]) or "") for c in POL_COLUMNS if c[0] != "match_tags"}
        tags = p.match_tags if isinstance(p.match_tags, list) else []
        d["match_tags"] = ",".join(tags)
        rows.append(d)
    buf = rows_to_xlsx(rows, POL_COLUMNS)
    return Response(content=buf.getvalue(), media_type=XLSX_MEDIA,
                    headers={"Content-Disposition": "attachment; filename=policies.xlsx"})


@policies_router.post("/import")
async def import_policies(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    rows = xlsx_to_rows(content, POL_COLUMNS)
    created = 0
    for r in rows:
        tags = r.get("match_tags")
        if isinstance(tags, str):
            r["match_tags"] = [t.strip() for t in tags.split(",") if t.strip()]
        r = {k: v for k, v in r.items() if v not in (None, "")}
        if not r.get("title"):
            continue
        db.add(Policy(**r))
        created += 1
    db.commit()
    return {"created": created}


@policies_router.post("/", response_model=PolicyResponse, status_code=201)
def create_policy(data: PolicyCreate, db: Session = Depends(get_db)):
    policy = Policy(**data.model_dump())
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return PolicyResponse.model_validate(policy)


@policies_router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(policy_id: int, data: PolicyUpdate, db: Session = Depends(get_db)):
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


PROP_COLUMNS = [
    ("name", "物业名称"), ("type", "类型"), ("area", "面积"), ("floor", "楼层"),
    ("price", "单价"), ("location", "位置"), ("features", "特色"), ("tags", "标签(逗号分隔)"),
]


@properties_router.get("/export")
def export_properties(db: Session = Depends(get_db)):
    rows = []
    for p in db.query(Property).order_by(Property.id).all():
        d = {c[0]: (getattr(p, c[0]) or "") for c in PROP_COLUMNS if c[0] != "tags"}
        tags = p.tags if isinstance(p.tags, list) else []
        d["tags"] = ",".join(tags)
        rows.append(d)
    buf = rows_to_xlsx(rows, PROP_COLUMNS)
    return Response(content=buf.getvalue(), media_type=XLSX_MEDIA,
                    headers={"Content-Disposition": "attachment; filename=properties.xlsx"})


@properties_router.post("/import")
async def import_properties(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    rows = xlsx_to_rows(content, PROP_COLUMNS)
    created = 0
    for r in rows:
        tags = r.get("tags")
        if isinstance(tags, str):
            r["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
        r = {k: v for k, v in r.items() if v not in (None, "")}
        if not r.get("name"):
            continue
        db.add(Property(**r))
        created += 1
    db.commit()
    return {"created": created}


@properties_router.post("/", response_model=PropertyResponse, status_code=201)
def create_property(data: PropertyCreate, db: Session = Depends(get_db)):
    prop = Property(**data.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return PropertyResponse.model_validate(prop)


@properties_router.put("/{property_id}", response_model=PropertyResponse)
def update_property(property_id: int, data: PropertyUpdate, db: Session = Depends(get_db)):
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
