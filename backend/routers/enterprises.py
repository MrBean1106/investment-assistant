"""Enterprise CRUD API router."""

from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from fastapi.responses import Response
from services.excel_io import rows_to_xlsx, xlsx_to_rows, XLSX_MEDIA
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import Enterprise, ChainNodeEnterprise, Report, Lead, Document
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
            | (Enterprise.founder.ilike(like))
            | (Enterprise.project_source.ilike(like))
        )
    if status:
        query = query.filter(Enterprise.status == status)
    total = query.count()
    items = query.order_by(Enterprise.updated_at.desc()).offset(skip).limit(limit).all()
    return EnterpriseListResponse(
        items=[EnterpriseResponse.model_validate(e) for e in items],
        total=total,
    )


ENT_COLUMNS = [
    ("name", "企业名称"), ("industry", "所属行业"), ("segment", "细分领域"),
    ("region", "所在地区"), ("scale", "企业规模"), ("status", "招商状态"),
    ("contact", "联系人"), ("demand", "核心需求"), ("invest_rating", "投资评级"),
    ("tags", "标签(逗号分隔)"),
    # ── 模板扩展字段（表头沿用企业库 Excel 模板，便于互通）──
    ("founder", "创始人/法人"), ("registration", "注册地"), ("leader", "负责人"),
    ("intro", "简介（主营、行业地位、营收情况）"),
    ("main_business", "主营业务情况"),
    ("funding_round", "融资轮次"), ("pre_valuation", "投前估值（亿元）"),
    ("demand_amount", "需求金额（万元）"), ("first_visit", "首次拜访"),
    ("space_demand", "招商需求（㎡）"), ("recommended_park", "推荐园区"),
    ("decision_status", "决策状态"),
    ("progress_update", "2026年6月  进度更新（详细）每两周更新"),
    ("project_source", "项目来源"), ("investment_lead", "投资负责人"),
    ("investment_contact", "招商对接人"), ("first_contact", "首次对接"),
    ("related_files", "相关文件"),
]

# 导入时转换为数值的字段
_FLOAT_FIELDS = {"pre_valuation", "demand_amount"}


def _coerce_row(r: dict) -> dict:
    """清理导入行：标签拆分、数值字段转换、空值剔除。"""
    tags = r.get("tags")
    if isinstance(tags, str):
        r["tags"] = [t.strip() for t in tags.split(",") if t.strip()]
    for f in _FLOAT_FIELDS:
        v = r.get(f)
        if v in (None, ""):
            continue
        if isinstance(v, str):
            cleaned = v.replace(" ", "").replace(",", "").strip()
            if cleaned:
                try:
                    r[f] = float(cleaned)
                except ValueError:
                    r[f] = None
        elif isinstance(v, (int, float)):
            r[f] = float(v)
    return {k: v for k, v in r.items() if v not in (None, "")}


@router.get("/export")
def export_enterprises(db: Session = Depends(get_db)):
    ents = db.query(Enterprise).order_by(Enterprise.id).all()
    rows = []
    for e in ents:
        d = {c[0]: (getattr(e, c[0]) or "") for c in ENT_COLUMNS if c[0] != "tags"}
        tags = e.tags if isinstance(e.tags, list) else []
        d["tags"] = ",".join(tags)
        rows.append(d)
    buf = rows_to_xlsx(rows, ENT_COLUMNS)
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MEDIA,
        headers={"Content-Disposition": "attachment; filename=enterprises.xlsx"},
    )


@router.post("/import")
async def import_enterprises(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    rows = xlsx_to_rows(content, ENT_COLUMNS)
    created = 0
    for raw in rows:
        r = _coerce_row(raw)
        if not r.get("name"):
            continue
        db.add(Enterprise(**r))
        created += 1
    db.commit()
    return {"created": created}


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
    # 清理关联数据，避免外键/孤儿记录（模型未配置 cascade）
    db.query(ChainNodeEnterprise).filter(ChainNodeEnterprise.enterprise_id == enterprise_id).delete()
    db.query(Report).filter(Report.enterprise_id == enterprise_id).delete()
    # Lead 可能有独立价值，解除关联而非删除
    db.query(Lead).filter(Lead.enterprise_id == enterprise_id).update({Lead.enterprise_id: None})
    db.query(Document).filter(Document.enterprise_id == enterprise_id).delete()
    db.delete(ent)
    db.commit()
