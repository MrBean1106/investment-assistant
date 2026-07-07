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
