"""Pydantic schemas for all models."""
from pydantic import BaseModel
from typing import Optional


class PolicyBase(BaseModel):
    title: str
    level: Optional[str] = None
    category: Optional[str] = None
    scope: Optional[str] = None
    benefit: Optional[str] = None
    match_tags: list[str] = []


class PolicyCreate(PolicyBase):
    pass


class PolicyUpdate(BaseModel):
    title: Optional[str] = None
    level: Optional[str] = None
    category: Optional[str] = None
    scope: Optional[str] = None
    benefit: Optional[str] = None
    match_tags: Optional[list[str]] = None


class PolicyResponse(PolicyBase):
    id: int
    model_config = {"from_attributes": True}


class PropertyBase(BaseModel):
    name: str
    type: Optional[str] = None
    area: Optional[str] = None
    floor: Optional[str] = None
    price: Optional[str] = None
    location: Optional[str] = None
    features: Optional[str] = None
    tags: list[str] = []


class PropertyCreate(PropertyBase):
    pass


class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    area: Optional[str] = None
    floor: Optional[str] = None
    price: Optional[str] = None
    location: Optional[str] = None
    features: Optional[str] = None
    tags: Optional[list[str]] = None


class PropertyResponse(PropertyBase):
    id: int
    model_config = {"from_attributes": True}


# ── Industry Chain schemas ──

class ChainResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    model_config = {"from_attributes": True}


class LinkedEnterprise(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    segment: Optional[str] = None
    model_config = {"from_attributes": True}


class ChainNodeResponse(BaseModel):
    id: int
    chain_id: int
    name: str
    layer: str
    description: Optional[str] = None
    enterprises: list[LinkedEnterprise] = []
    model_config = {"from_attributes": True}


class ChainEdgeResponse(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    model_config = {"from_attributes": True}


class IndustryChainResponse(BaseModel):
    chain: ChainResponse
    nodes: list[ChainNodeResponse]
    edges: list[ChainEdgeResponse]
