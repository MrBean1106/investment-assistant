"""
Industry Chain models — nodes and edges of industrial chain graph.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, func
from database import Base


class IndustryChainNode(Base):
    __tablename__ = "industry_chain_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="节点名称")
    layer = Column(String(20), nullable=False, comment="层级（上游/中游/下游）")
    description = Column(Text, comment="节点描述")
    enterprises = Column(JSON, default=[], comment="关联企业列表")
    created_at = Column(DateTime, server_default=func.now())


class IndustryChainEdge(Base):
    __tablename__ = "industry_chain_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_node_id = Column(Integer, ForeignKey("industry_chain_nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("industry_chain_nodes.id"), nullable=False)
