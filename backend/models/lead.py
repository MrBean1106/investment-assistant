"""Lead (招商线索) model — the dynamic follow-up layer on top of the enterprise pool.

A lead tracks a company through the investment-promotion funnel: from first
contact to signed/landed, with owner, next action, and a follow-up log.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Date, ForeignKey, func
from database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), comment="线索标题")
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=True, comment="关联企业ID")
    company_name = Column(String(200), nullable=False, index=True, comment="企业名称")
    source = Column(String(50), comment="线索来源（展会/招商推介/以商招商/主动挖掘/网络）")
    stage = Column(String(30), default="初步接触", comment="阶段")
    priority = Column(String(10), default="中", comment="优先级（高/中/低）")
    owner = Column(String(100), comment="负责人")
    contact_name = Column(String(100), comment="联系人")
    contact_info = Column(String(200), comment="联系方式")
    intent_investment = Column(String(100), comment="意向投资金额")
    intent_region = Column(String(100), comment="意向落地地区")
    expected_landing_date = Column(Date, comment="预计落地时间")
    progress = Column(Integer, default=0, comment="进度（0-100）")
    next_action = Column(String(300), comment="下一步动作")
    notes = Column(Text, comment="备注")
    follow_ups = Column(JSON, default=[], comment="对接记录列表")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
