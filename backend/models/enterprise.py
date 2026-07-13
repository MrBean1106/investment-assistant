"""
Enterprise model — core entity for the investment assistant.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Float, func
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
    # ── 企业库模板扩展字段（来源：浦东建设集团AI竞赛企业库模板）──
    founder = Column(String(100), comment="创始人/法人")
    registration = Column(String(100), comment="注册地")
    leader = Column(String(100), comment="负责人")
    intro = Column(Text, comment="简介（主营、行业地位、营收情况）")
    funding_round = Column(String(20), comment="融资轮次")
    pre_valuation = Column(Float, comment="投前估值（亿元）")
    demand_amount = Column(Float, comment="需求金额（万元）")
    first_visit = Column(String(50), comment="首次拜访")
    space_demand = Column(String(100), comment="招商需求（㎡）")
    recommended_park = Column(String(200), comment="推荐园区")
    decision_status = Column(String(50), comment="决策状态")
    progress_update = Column(Text, comment="进度更新（每两周更新）")
    project_source = Column(String(100), comment="项目来源")
    investment_lead = Column(String(100), comment="投资负责人")
    investment_contact = Column(String(100), comment="招商对接人")
    first_contact = Column(String(50), comment="首次对接")
    related_files = Column(Text, comment="相关文件")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
