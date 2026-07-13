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
import re

from database import SessionLocal
from models.setting import Setting

_ENV_KEY = "DEEPSEEK_API_KEY"
_ENV_URL = "DEEPSEEK_BASE_URL"
_ENV_MODEL = "DEEPSEEK_MODEL"

_DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
_DEFAULT_MODEL = "deepseek-chat"

# Invisible / whitespace chars that frequently sneak in when copying a key
# from a webpage or document (full-width space, zero-width, nbsp, BOM, CRLF…)
_INVISIBLE_RE = re.compile(r"[\u200b\u200c\u200d\ufeff\u00a0\u3000\r\n\t ]+")


def _sanitize_key(raw: str | None) -> str:
    """Strip copy-paste artifacts from an API key.

    Valid LLM keys are ASCII; when a key is pasted from a site it often picks
    up a leading/trailing full-width space, a stray smart quote, or a
    zero-width character. Left in place, httpx fails to ascii-encode the
    `Authorization: Bearer <key>` header and raises
    `UnicodeEncodeError: 'ascii' codec can't encode ...` (position 7-10).

    We strip quotes/whitespace, drop invisible chars, then remove any
    remaining non-ASCII bytes so the key is always safe to send.
    """
    if not raw:
        return raw or ""
    k = raw
    # strip a single surrounding quote pair (straight or curly)
    if len(k) >= 2 and k[0] in "\"'“’”" and k[-1] in "\"'“’”":
        k = k[1:-1]
    k = _INVISIBLE_RE.sub("", k)
    # valid keys are ASCII — drop anything else to avoid the httpx ascii crash
    return k.encode("ascii", "ignore").decode("ascii")


def _sanitize_url(raw: str | None) -> str:
    if not raw:
        return raw or ""
    return _INVISIBLE_RE.sub("", raw)


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
        api_key = _sanitize_key(env_key)
        source = "env"
    else:
        api_key = _sanitize_key(get_setting("llm_api_key", ""))
        source = "db" if api_key else "none"

    # Base URL / model: env overrides DB, DB falls back to defaults.
    db_url = get_setting("llm_base_url", "")
    base_url = _sanitize_url(env_url if env_url else (db_url or _DEFAULT_BASE_URL))

    db_model = get_setting("llm_model", "")
    model = _sanitize_url(env_model if env_model else (db_model or _DEFAULT_MODEL))

    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model,
        "source": source,
        "configured": bool(api_key),
    }
