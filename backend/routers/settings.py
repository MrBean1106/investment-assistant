"""
Settings endpoints — runtime configuration via the in-app Settings page.
Currently supports LLM (大模型) API configuration.
"""
import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.llm_config import get_llm_config, set_setting, _sanitize_key, _sanitize_url

router = APIRouter()


class LlmConfigIn(BaseModel):
    # api_key: None => 不修改已保存的值；"" => 清除；非空 => 设置新值
    api_key: str | None = None
    base_url: str = ""
    model: str = ""
    clear_key: bool = False


def _mask(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 6:
        return "*" * len(key)
    return key[:3] + "*" * (len(key) - 6) + key[-3:]


@router.get("/settings/llm")
def get_llm_settings():
    cfg = get_llm_config()
    return {
        "configured": cfg["configured"],
        "source": cfg["source"],
        "base_url": cfg["base_url"],
        "model": cfg["model"],
        "masked_key": _mask(cfg["api_key"]),
    }


@router.post("/settings/llm")
def save_llm_settings(body: LlmConfigIn):
    # Persist to DB. Env vars take precedence at read time, so a saved value
    # only applies when the corresponding env var is not set (typical local dev).
    notes: list[str] = []
    if body.clear_key:
        set_setting("llm_api_key", "")
    elif body.api_key:  # 非空 -> 覆盖（并清理复制粘贴带入的非法字符）
        clean = _sanitize_key(body.api_key)
        if clean != body.api_key:
            notes.append("已自动清理 Key 中的非法字符（如全角空格、智能引号），若非预期请重新复制。")
        set_setting("llm_api_key", clean)

    if body.base_url:
        set_setting("llm_base_url", _sanitize_url(body.base_url))
    if body.model:
        set_setting("llm_model", _sanitize_url(body.model))

    cfg = get_llm_config()
    return {
        "ok": True,
        "configured": cfg["configured"],
        "source": cfg["source"],
        "masked_key": _mask(cfg["api_key"]),
        "note": "检测到 DEEPSEEK_API_KEY 环境变量，UI 配置暂不生效。如需改用应用内设置，请移除该环境变量后重启服务。"
        if cfg["source"] == "env"
        else ("；".join(notes) if notes else ""),
    }


@router.post("/settings/llm/test")
def test_llm_settings(body: LlmConfigIn):
    """Verify the API key works by sending a minimal completion request."""
    cfg = get_llm_config()
    key = _sanitize_key(body.api_key) or cfg["api_key"]
    base_url = _sanitize_url(body.base_url) or cfg["base_url"]
    model = _sanitize_url(body.model) or cfg["model"]
    if not key:
        raise HTTPException(status_code=400, detail="未提供 API Key")

    try:
        client = openai.OpenAI(api_key=key, base_url=base_url)
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=5,
        )
        return {"ok": True, "message": "连接成功，API Key 可用。"}
    except Exception as e:
        return {"ok": False, "message": f"连接失败：{str(e)}"}
