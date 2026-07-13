"""
Enterprise model — core entity for the investment assistant.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func
from database import Base


class Enterprise(Base):
    __tablename__ = "enterprises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, index=True, comment="企业名称")
    industry = Column(String(100), nullable=False, comment="所属行业")
    segment = Column(String(100), comment="细分领域")
    region = Column(String(100), comment="所在地区")
    scale = Column(String(20), comment="企业规模（大型/中型/小型）")
    status = Column(String(20), default="线索", comment="招商状态（线索/洽谈/签约/落地）")
    contact = Column(String(200), comment="联系人信息")
    demand = Column(Text, comment="核心需求描述")
    invest_rating = Column(String(10), comment="投资评级（A/A-/B+/B/C）")
    tags = Column(JSON, default=[], comment="标签列表")
    pain_points = Column(JSON, comment="痛点分析 JSON")
    needs = Column(JSON, comment="多维需求 JSON")
    analysis_text = Column(Text, comment="AI 分析文本")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
