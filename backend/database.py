"""
Database configuration for 产业招商助手.

Uses PostgreSQL with SQLAlchemy ORM.
For MVP / local dev, can fall back to SQLite by changing DATABASE_URL.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Force SQLite on Railway (Railway auto-sets a PostgreSQL DATABASE_URL but we don't have the driver)
DATABASE_URL = "sqlite:///./investment.db"

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
