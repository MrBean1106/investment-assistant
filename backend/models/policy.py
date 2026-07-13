"""
Policy model — government policies for enterprise matching.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func
from database import Base


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(300), nullable=False, comment="政策标题")
    level = Column(String(20), comment="政策级别（国家级/省级/市级/区级）")
    category = Column(String(50), comment="政策类别（税收优惠/资金奖补/土地保障/人才政策/其他）")
    scope = Column(Text, comment="适用范围")
    benefit = Column(Text, comment="优惠政策内容")
    match_tags = Column(JSON, default=[], comment="匹配标签")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
