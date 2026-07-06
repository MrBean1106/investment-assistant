"""Industry Chain API — full CRUD with enterprise mapping."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import IndustryChainNode, IndustryChainEdge, Enterprise
from schemas import IndustryChainResponse

router = APIRouter()


# ── Pydantic request models ──

class NodeCreate(BaseModel):
    name: str
    layer: str  # 上游/中游/下游
    description: Optional[str] = None
    enterprises: list[str] = []


class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int


class AddEnterprise(BaseModel):
    name: str


# ── GET full chain ──

@router.get("/", response_model=IndustryChainResponse)
def get_industry_chain(db: Session = Depends(get_db)):
    nodes = db.query(IndustryChainNode).all()
    edges = db.query(IndustryChainEdge).all()

    # Enrich nodes with enterprise data from enterprise DB
    all_ents = db.query(Enterprise).all()
    ent_map = {e.name: e for e in all_ents}

    enriched_nodes = []
    for n in nodes:
        node_enterprises = n.enterprises or []
        # Add enterprises from DB that match this node's industry/segment
        for e in all_ents:
            if e.name not in node_enterprises:
                # Auto-match by industry relationship
                if n.layer in ('上游', '中游', '下游') and e.segment and (
                    e.segment in (n.description or '') or
                    any(kw in (n.name or '') for kw in (e.industry or '').split('/'))
                ):
                    continue  # Skip auto-matching for now; use manual assignment
        enriched_nodes.append(n)

    return IndustryChainResponse(nodes=enriched_nodes, edges=edges)


# ── Node CRUD ──

@router.post("/nodes")
def create_node(data: NodeCreate, db: Session = Depends(get_db)):
    node = IndustryChainNode(
        name=data.name,
        layer=data.layer,
        description=data.description,
        enterprises=data.enterprises,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return {"id": node.id, "name": node.name, "layer": node.layer}


@router.delete("/nodes/{node_id}")
def delete_node(node_id: int, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(IndustryChainNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    # Delete associated edges
    db.query(IndustryChainEdge).filter(
        (IndustryChainEdge.source_node_id == node_id) |
        (IndustryChainEdge.target_node_id == node_id)
    ).delete()
    db.delete(node)
    db.commit()
    return {"deleted": node_id}


# ── Edge CRUD ──

@router.post("/edges")
def create_edge(data: EdgeCreate, db: Session = Depends(get_db)):
    # Verify both nodes exist
    src = db.query(IndustryChainNode).filter(IndustryChainNode.id == data.source_node_id).first()
    tgt = db.query(IndustryChainNode).filter(IndustryChainNode.id == data.target_node_id).first()
    if not src or not tgt:
        raise HTTPException(status_code=404, detail="Source or target node not found")

    edge = IndustryChainEdge(source_node_id=data.source_node_id, target_node_id=data.target_node_id)
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return {"id": edge.id, "source": edge.source_node_id, "target": edge.target_node_id}


@router.delete("/edges/{edge_id}")
def delete_edge(edge_id: int, db: Session = Depends(get_db)):
    edge = db.query(IndustryChainEdge).filter(IndustryChainEdge.id == edge_id).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    db.delete(edge)
    db.commit()
    return {"deleted": edge_id}


# ── Enterprise mapping on nodes ──

@router.post("/nodes/{node_id}/enterprises")
def add_enterprise_to_node(node_id: int, data: AddEnterprise, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(IndustryChainNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    enterprises = list(node.enterprises or [])
    if data.name not in enterprises:
        enterprises.append(data.name)
    node.enterprises = enterprises
    db.commit()
    return {"node_id": node_id, "enterprises": enterprises}


@router.delete("/nodes/{node_id}/enterprises/{name:path}")
def remove_enterprise_from_node(node_id: int, name: str, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(IndustryChainNode.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    enterprises = [e for e in (node.enterprises or []) if e != name]
    node.enterprises = enterprises
    db.commit()
    return {"node_id": node_id, "enterprises": enterprises}


# ── Enterprise list for mapping ──

@router.get("/available-enterprises")
def list_available_enterprises(db: Session = Depends(get_db)):
    """List all enterprises from the DB for mapping to chain nodes."""
    ents = db.query(Enterprise).order_by(Enterprise.name).all()
    return [
        {"id": e.id, "name": e.name, "industry": e.industry, "segment": e.segment or ""}
        for e in ents
    ]
