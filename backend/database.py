"""
Database configuration for 产业招商助手.

Uses SQLAlchemy ORM with configurable database backend.
Default: SQLite for local dev / MVP; can be overridden via DATABASE_URL env var.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Read DATABASE_URL from environment, fallback to SQLite
# Supports: sqlite, postgresql+psycopg2, postgresql+pg8000, etc.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./investment.db")

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency that provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Call once at startup."""
    Base.metadata.create_all(bind=engine)
    # 兼容已有 SQLite 库：新增列通过 ALTER 追加，不丢数据
    _migrate_enterprise_columns()


# 企业库模板扩展字段 -> (列名, SQL 类型)。init_db 时若缺失则追加。
_ENTERPRISE_NEW_COLUMNS = [
    ("founder", "VARCHAR(100)"),
    ("registration", "VARCHAR(100)"),
    ("leader", "VARCHAR(100)"),
    ("intro", "TEXT"),
    ("funding_round", "VARCHAR(20)"),
    ("pre_valuation", "FLOAT"),
    ("demand_amount", "FLOAT"),
    ("first_visit", "VARCHAR(50)"),
    ("space_demand", "VARCHAR(100)"),
    ("recommended_park", "VARCHAR(200)"),
    ("decision_status", "VARCHAR(50)"),
    ("progress_update", "TEXT"),
    ("project_source", "VARCHAR(100)"),
    ("investment_lead", "VARCHAR(100)"),
    ("investment_contact", "VARCHAR(100)"),
    ("first_contact", "VARCHAR(50)"),
    ("related_files", "TEXT"),
]


def _migrate_enterprise_columns():
    """为已存在的 enterprises 表追加模板新增字段（幂等）。"""
    try:
        inspector = __import__("sqlalchemy").inspect(engine)
        if "enterprises" not in inspector.get_table_names():
            return
        existing = {c["name"] for c in inspector.get_columns("enterprises")}
        with engine.begin() as conn:
            for col, sql_type in _ENTERPRISE_NEW_COLUMNS:
                if col not in existing:
                    conn.execute(__import__("sqlalchemy").text(
                        f'ALTER TABLE enterprises ADD COLUMN {col} {sql_type}'
                    ))
    except Exception as e:  # pragma: no cover - 迁移失败不应阻断启动
        print("⚠️ 企业库字段迁移跳过：", e)
