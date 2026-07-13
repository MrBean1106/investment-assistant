"""Industry Chain API — multi-chain CRUD with enterprise linking."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from models import IndustryChain, IndustryChainNode, IndustryChainEdge, ChainNodeEnterprise, Enterprise
from schemas import (
    ChainResponse, ChainNodeResponse, ChainEdgeResponse, IndustryChainResponse, LinkedEnterprise,
)

router = APIRouter()


# ── Pydantic request models ──

class ChainCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ChainUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class NodeCreate(BaseModel):
    name: str
    layer: str  # 上游/中游/下游
    description: Optional[str] = None


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    layer: Optional[str] = None
    description: Optional[str] = None


class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int


class LinkEnterprise(BaseModel):
    enterprise_id: int


# ── Helper: enrich node with linked enterprises ──

def _enrich_nodes(db: Session, nodes):
    """Attach linked enterprise data to each node."""
    node_ids = [n.id for n in nodes]
    links = db.query(ChainNodeEnterprise).filter(
        ChainNodeEnterprise.node_id.in_(node_ids)
    ).all() if node_ids else []

    ent_ids = list(set(l.enterprise_id for l in links))
    ents = {e.id: e for e in db.query(Enterprise).filter(Enterprise.id.in_(ent_ids)).all()} if ent_ids else {}

    node_links = {}
    for l in links:
        node_links.setdefault(l.node_id, []).append(l.enterprise_id)

    result = []
    for n in nodes:
        ent_data = []
        for eid in node_links.get(n.id, []):
            e = ents.get(eid)
            if e:
                ent_data.append(LinkedEnterprise(id=e.id, name=e.name, industry=e.industry, segment=e.segment))
        result.append(ChainNodeResponse(
            id=n.id, chain_id=n.chain_id, name=n.name, layer=n.layer,
            description=n.description, enterprises=ent_data,
        ))
    return result


# ═══════════════════════════════════════════════
# Chain CRUD
# ═══════════════════════════════════════════════

@router.get("/chains", response_model=list[ChainResponse])
def list_chains(db: Session = Depends(get_db)):
    chains = db.query(IndustryChain).order_by(IndustryChain.id).all()
    return [ChainResponse.model_validate(c) for c in chains]


@router.post("/chains", response_model=ChainResponse, status_code=201)
def create_chain(data: ChainCreate, db: Session = Depends(get_db)):
    chain = IndustryChain(name=data.name, description=data.description)
    db.add(chain)
    db.commit()
    db.refresh(chain)
    return ChainResponse.model_validate(chain)


@router.get("/chains/{chain_id}", response_model=ChainResponse)
def get_chain(chain_id: int, db: Session = Depends(get_db)):
    chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    return ChainResponse.model_validate(chain)


@router.put("/chains/{chain_id}", response_model=ChainResponse)
def update_chain(chain_id: int, data: ChainUpdate, db: Session = Depends(get_db)):
    chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    if data.name is not None:
        chain.name = data.name
    if data.description is not None:
        chain.description = data.description
    db.commit()
    db.refresh(chain)
    return ChainResponse.model_validate(chain)


@router.delete("/chains/{chain_id}", status_code=204)
def delete_chain(chain_id: int, db: Session = Depends(get_db)):
    chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    # Delete linked enterprises, edges, nodes, then chain
    node_ids = [n.id for n in db.query(IndustryChainNode).filter(IndustryChainNode.chain_id == chain_id).all()]
    if node_ids:
        db.query(ChainNodeEnterprise).filter(ChainNodeEnterprise.node_id.in_(node_ids)).delete()
        db.query(IndustryChainEdge).filter(
            (IndustryChainEdge.source_node_id.in_(node_ids)) |
            (IndustryChainEdge.target_node_id.in_(node_ids))
        ).delete()
        db.query(IndustryChainNode).filter(IndustryChainNode.chain_id == chain_id).delete()
    db.delete(chain)
    db.commit()


# ═══════════════════════════════════════════════
# Full chain graph (chain + nodes + edges + enterprises)
# ═══════════════════════════════════════════════

@router.get("/chains/{chain_id}/full", response_model=IndustryChainResponse)
def get_full_chain(chain_id: int, db: Session = Depends(get_db)):
    chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")

    nodes = db.query(IndustryChainNode).filter(IndustryChainNode.chain_id == chain_id).all()
    edges = db.query(IndustryChainEdge).filter(
        IndustryChainEdge.source_node_id.in_([n.id for n in nodes])
    ).all() if nodes else []

    return IndustryChainResponse(
        chain=ChainResponse.model_validate(chain),
        nodes=_enrich_nodes(db, nodes),
        edges=[ChainEdgeResponse.model_validate(e) for e in edges],
    )


# ═══════════════════════════════════════════════
# Node CRUD (scoped to a chain)
# ═══════════════════════════════════════════════

@router.post("/chains/{chain_id}/nodes")
def create_node(chain_id: int, data: NodeCreate, db: Session = Depends(get_db)):
    chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
    if not chain:
        raise HTTPException(status_code=404, detail="Chain not found")
    node = IndustryChainNode(
        chain_id=chain_id, name=data.name, layer=data.layer, description=data.description,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return {"id": node.id, "name": node.name, "layer": node.layer, "chain_id": node.chain_id}


@router.put("/chains/{chain_id}/nodes/{node_id}")
def update_node(chain_id: int, node_id: int, data: NodeUpdate, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    if data.name is not None:
        node.name = data.name
    if data.layer is not None:
        node.layer = data.layer
    if data.description is not None:
        node.description = data.description
    db.commit()
    db.refresh(node)
    return {"id": node.id, "name": node.name, "layer": node.layer}


@router.delete("/chains/{chain_id}/nodes/{node_id}", status_code=204)
def delete_node(chain_id: int, node_id: int, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    # Cascade: delete edges + enterprise links
    db.query(ChainNodeEnterprise).filter(ChainNodeEnterprise.node_id == node_id).delete()
    db.query(IndustryChainEdge).filter(
        (IndustryChainEdge.source_node_id == node_id) |
        (IndustryChainEdge.target_node_id == node_id)
    ).delete()
    db.delete(node)
    db.commit()


# ═══════════════════════════════════════════════
# Edge CRUD (scoped to a chain)
# ═══════════════════════════════════════════════

@router.post("/chains/{chain_id}/edges")
def create_edge(chain_id: int, data: EdgeCreate, db: Session = Depends(get_db)):
    # Verify both nodes belong to this chain
    src = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == data.source_node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    tgt = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == data.target_node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not src or not tgt:
        raise HTTPException(status_code=404, detail="Source or target node not found in this chain")

    edge = IndustryChainEdge(source_node_id=data.source_node_id, target_node_id=data.target_node_id)
    db.add(edge)
    db.commit()
    db.refresh(edge)
    return {"id": edge.id, "source": edge.source_node_id, "target": edge.target_node_id}


@router.delete("/chains/{chain_id}/edges/{edge_id}", status_code=204)
def delete_edge(chain_id: int, edge_id: int, db: Session = Depends(get_db)):
    edge = db.query(IndustryChainEdge).filter(IndustryChainEdge.id == edge_id).first()
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    # Verify nodes belong to chain
    src = db.query(IndustryChainNode).filter(IndustryChainNode.id == edge.source_node_id, IndustryChainNode.chain_id == chain_id).first()
    if not src:
        raise HTTPException(status_code=404, detail="Edge not in this chain")
    db.delete(edge)
    db.commit()


# ═══════════════════════════════════════════════
# Enterprise linking (scoped to a chain)
# ═══════════════════════════════════════════════

@router.get("/chains/{chain_id}/nodes/{node_id}/enterprises")
def list_node_enterprises(chain_id: int, node_id: int, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    links = db.query(ChainNodeEnterprise).filter(ChainNodeEnterprise.node_id == node_id).all()
    ent_ids = [l.enterprise_id for l in links]
    ents = db.query(Enterprise).filter(Enterprise.id.in_(ent_ids)).all() if ent_ids else []
    return [
        {"id": e.id, "name": e.name, "industry": e.industry, "segment": e.segment}
        for e in ents
    ]


@router.post("/chains/{chain_id}/nodes/{node_id}/enterprises")
def link_enterprise(chain_id: int, node_id: int, data: LinkEnterprise, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    ent = db.query(Enterprise).filter(Enterprise.id == data.enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    existing = db.query(ChainNodeEnterprise).filter(
        ChainNodeEnterprise.node_id == node_id,
        ChainNodeEnterprise.enterprise_id == data.enterprise_id,
    ).first()
    if existing:
        return {"node_id": node_id, "enterprise_id": data.enterprise_id, "status": "already_linked"}

    link = ChainNodeEnterprise(node_id=node_id, enterprise_id=data.enterprise_id)
    db.add(link)
    db.commit()
    return {"node_id": node_id, "enterprise_id": data.enterprise_id, "status": "linked"}


@router.delete("/chains/{chain_id}/nodes/{node_id}/enterprises/{enterprise_id}", status_code=204)
def unlink_enterprise(chain_id: int, node_id: int, enterprise_id: int, db: Session = Depends(get_db)):
    node = db.query(IndustryChainNode).filter(
        IndustryChainNode.id == node_id, IndustryChainNode.chain_id == chain_id
    ).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    db.query(ChainNodeEnterprise).filter(
        ChainNodeEnterprise.node_id == node_id,
        ChainNodeEnterprise.enterprise_id == enterprise_id,
    ).delete()
    db.commit()


# ═══════════════════════════════════════════════
# Available enterprises (for linking dropdown)
# ═══════════════════════════════════════════════

@router.get("/available-enterprises")
def list_available_enterprises(db: Session = Depends(get_db)):
    ents = db.query(Enterprise).order_by(Enterprise.name).all()
    return [
        {"id": e.id, "name": e.name, "industry": e.industry, "segment": e.segment or ""}
        for e in ents
    ]


# ═══════════════════════════════════════════════
# Enterprise chain memberships
# ═══════════════════════════════════════════════

@router.get("/enterprise/{enterprise_id}/chains")
def get_enterprise_chain_memberships(enterprise_id: int, db: Session = Depends(get_db)):
    """Return all chain nodes this enterprise is linked to."""
    links = db.query(ChainNodeEnterprise).filter(
        ChainNodeEnterprise.enterprise_id == enterprise_id
    ).all()

    if not links:
        return []

    node_ids = [l.node_id for l in links]
    nodes = db.query(IndustryChainNode).filter(IndustryChainNode.id.in_(node_ids)).all()
    chain_ids = list(set(n.chain_id for n in nodes))
    chains = {c.id: c for c in db.query(IndustryChain).filter(IndustryChain.id.in_(chain_ids)).all()}

    result = []
    for n in nodes:
        chain = chains.get(n.chain_id)
        result.append({
            "node_id": n.id,
            "node_name": n.name,
            "node_layer": n.layer,
            "chain_id": n.chain_id,
            "chain_name": chain.name if chain else "",
        })

    return result
