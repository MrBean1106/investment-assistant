"""
Property model — real estate resources for enterprise matching.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, func
from database import Base


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, comment="物业名称")
    type = Column(String(50), comment="物业类型（研发办公/生产厂房/商务办公/研发中试）")
    area = Column(String(50), comment="可用面积")
    floor = Column(String(50), comment="楼层")
    price = Column(String(50), comment="单价")
    location = Column(String(200), comment="位置")
    features = Column(Text, comment="特色/备注")
    tags = Column(JSON, default=[], comment="标签")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
