"""
Industry Chain models — multi-chain support with enterprise linking.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from database import Base


class IndustryChain(Base):
    """A named industry chain (e.g., 新能源汽车, 半导体, 生物医药)."""
    __tablename__ = "industry_chains"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="产业链名称")
    description = Column(Text, comment="产业链描述")
    created_at = Column(DateTime, server_default=func.now())


class IndustryChainNode(Base):
    __tablename__ = "industry_chain_nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    chain_id = Column(Integer, ForeignKey("industry_chains.id"), nullable=False, comment="所属产业链")
    name = Column(String(200), nullable=False, comment="节点名称")
    layer = Column(String(20), nullable=False, comment="层级（上游/中游/下游）")
    description = Column(Text, comment="节点描述")
    created_at = Column(DateTime, server_default=func.now())


class IndustryChainEdge(Base):
    __tablename__ = "industry_chain_edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_node_id = Column(Integer, ForeignKey("industry_chain_nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("industry_chain_nodes.id"), nullable=False)


class ChainNodeEnterprise(Base):
    """Join table: links an enterprise from the DB to a specific chain node."""
    __tablename__ = "chain_node_enterprises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("industry_chain_nodes.id"), nullable=False)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=False)
