"""
Setting — generic key/value store for runtime configuration
(e.g. LLM API key entered through the in-app Settings page).
"""

from sqlalchemy import Column, String, Text
from database import Base


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text)
