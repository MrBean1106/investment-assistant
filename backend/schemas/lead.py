"""Pydantic schemas for the Lead (招商线索) API."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date


class LeadBase(BaseModel):
    title: Optional[str] = None
    enterprise_id: Optional[int] = None
    company_name: str = Field(..., min_length=1)
    source: Optional[str] = None
    stage: str = "初步接触"
    priority: str = "中"
    owner: Optional[str] = None
    contact_name: Optional[str] = None
    contact_info: Optional[str] = None
    intent_investment: Optional[str] = None
    intent_region: Optional[str] = None
    expected_landing_date: Optional[date] = None
    progress: int = 0
    next_action: Optional[str] = None
    notes: Optional[str] = None
    follow_ups: list[dict] = []


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    title: Optional[str] = None
    enterprise_id: Optional[int] = None
    company_name: Optional[str] = None
    source: Optional[str] = None
    stage: Optional[str] = None
    priority: Optional[str] = None
    owner: Optional[str] = None
    contact_name: Optional[str] = None
    contact_info: Optional[str] = None
    intent_investment: Optional[str] = None
    intent_region: Optional[str] = None
    expected_landing_date: Optional[date] = None
    progress: Optional[int] = None
    next_action: Optional[str] = None
    notes: Optional[str] = None
    follow_ups: Optional[list[dict]] = None


class LeadFollowUp(BaseModel):
    content: str = Field(..., min_length=1)
    owner: Optional[str] = None


class LeadResponse(LeadBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LeadListResponse(BaseModel):
    items: list[LeadResponse]
    total: int


class LeadStatsResponse(BaseModel):
    by_stage: dict[str, int]
    total: int
    active: int
