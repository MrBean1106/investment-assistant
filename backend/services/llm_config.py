"""
Runtime LLM configuration store.

Config resolution order:
  1. Environment variables (DEEPSEEK_API_KEY / DEEPSEEK_BASE_URL / DEEPSEEK_MODEL)
     — highest priority, used by production deploys (e.g. Railway).
  2. Database-stored settings (set via the in-app Settings page) — used when no
     env override is present (typical for local dev).
  3. Built-in defaults for base URL / model.
"""
import os

from database import SessionLocal
from models.setting import Setting

_ENV_KEY = "DEEPSEEK_API_KEY"
_ENV_URL = "DEEPSEEK_BASE_URL"
_ENV_MODEL = "DEEPSEEK_MODEL"

_DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
_DEFAULT_MODEL = "deepseek-chat"


def get_setting(key: str, default: str = "") -> str:
    db = SessionLocal()
    try:
        row = db.query(Setting).filter(Setting.key == key).first()
        return row.value if row else default
    finally:
        db.close()


def set_setting(key: str, value: str) -> None:
    db = SessionLocal()
    try:
        row = db.query(Setting).filter(Setting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(Setting(key=key, value=value))
        db.commit()
    finally:
        db.close()


def get_llm_config() -> dict:
    """Return the effective LLM config, resolving env > db > defaults."""
    env_key = os.getenv(_ENV_KEY)
    env_url = os.getenv(_ENV_URL)
    env_model = os.getenv(_ENV_MODEL)

    # API key: env overrides DB.
    if env_key:
        api_key = env_key
        source = "env"
    else:
        api_key = get_setting("llm_api_key", "")
        source = "db" if api_key else "none"

    # Base URL / model: env overrides DB, DB falls back to defaults.
    db_url = get_setting("llm_base_url", "")
    base_url = env_url if env_url else (db_url or _DEFAULT_BASE_URL)

    db_model = get_setting("llm_model", "")
    model = env_model if env_model else (db_model or _DEFAULT_MODEL)

    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "source": source,
        "configured": bool(api_key),
    }
