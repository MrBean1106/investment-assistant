"""Industry Chain API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import IndustryChainNode, IndustryChainEdge
from schemas import IndustryChainResponse

router = APIRouter()


@router.get("/", response_model=IndustryChainResponse)
def get_industry_chain(db: Session = Depends(get_db)):
    nodes = db.query(IndustryChainNode).all()
    edges = db.query(IndustryChainEdge).all()
    return IndustryChainResponse(
        nodes=nodes,
        edges=edges,
    )
