"""
Report model — generated investment reports.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, func
from database import Base


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enterprise_id = Column(Integer, ForeignKey("enterprises.id"), nullable=False, comment="关联企业")
    type = Column(String(20), nullable=False, comment="报告类型（招商建议/投资研判）")
    title = Column(String(300), comment="报告标题")
    content = Column(JSON, comment="报告内容 JSON")
    created_at = Column(DateTime, server_default=func.now())
