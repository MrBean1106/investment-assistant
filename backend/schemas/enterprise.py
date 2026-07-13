"""Pydantic schemas for Enterprise API."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EnterpriseBase(BaseModel):
    name: str = Field(..., min_length=1)
    industry: str = Field(..., min_length=1)
    segment: Optional[str] = None
    region: Optional[str] = None
    scale: Optional[str] = None
    status: str = "线索"
    contact: Optional[str] = None
    demand: Optional[str] = None
    invest_rating: Optional[str] = None
    tags: list[str] = []
    pain_points: Optional[dict] = None
    needs: Optional[dict] = None
    analysis_text: Optional[str] = None
    # ── 模板扩展字段 ──
    founder: Optional[str] = None
    registration: Optional[str] = None
    leader: Optional[str] = None
    intro: Optional[str] = None
    funding_round: Optional[str] = None
    pre_valuation: Optional[float] = None
    demand_amount: Optional[float] = None
    first_visit: Optional[str] = None
    space_demand: Optional[str] = None
    recommended_park: Optional[str] = None
    decision_status: Optional[str] = None
    progress_update: Optional[str] = None
    project_source: Optional[str] = None
    investment_lead: Optional[str] = None
    investment_contact: Optional[str] = None
    first_contact: Optional[str] = None
    related_files: Optional[str] = None


class EnterpriseCreate(EnterpriseBase):
    pass


class EnterpriseUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    segment: Optional[str] = None
    region: Optional[str] = None
    scale: Optional[str] = None
    status: Optional[str] = None
    contact: Optional[str] = None
    demand: Optional[str] = None
    invest_rating: Optional[str] = None
    tags: Optional[list[str]] = None
    pain_points: Optional[dict] = None
    needs: Optional[dict] = None
    analysis_text: Optional[str] = None
    # ── 模板扩展字段 ──
    founder: Optional[str] = None
    registration: Optional[str] = None
    leader: Optional[str] = None
    intro: Optional[str] = None
    funding_round: Optional[str] = None
    pre_valuation: Optional[float] = None
    demand_amount: Optional[float] = None
    first_visit: Optional[str] = None
    space_demand: Optional[str] = None
    recommended_park: Optional[str] = None
    decision_status: Optional[str] = None
    progress_update: Optional[str] = None
    project_source: Optional[str] = None
    investment_lead: Optional[str] = None
    investment_contact: Optional[str] = None
    first_contact: Optional[str] = None
    related_files: Optional[str] = None


class EnterpriseResponse(EnterpriseBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class EnterpriseListResponse(BaseModel):
    items: list[EnterpriseResponse]
    total: int
