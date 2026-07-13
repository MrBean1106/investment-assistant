"""
AI-powered endpoints: profile generation, resource matching, report generation,
and conversational chat with function calling.
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, SessionLocal
from models import Enterprise, Policy, Property, IndustryChainNode, IndustryChainEdge, Report
from services import generate_profile, match_resources, generate_report

router = APIRouter()

# ── DeepSeek / OpenAI compatible config (read dynamically at call time) ──
from services.llm_config import get_llm_config


def _ent_to_dict(ent: Enterprise) -> dict:
    return {
        "id": ent.id,
        "name": ent.name,
        "industry": ent.industry,
        "segment": ent.segment or "",
        "region": ent.region or "",
        "scale": ent.scale or "",
        "status": ent.status or "",
        "contact": ent.contact or "",
        "demand": ent.demand or "",
        "invest_rating": ent.invest_rating or "",
        "tags": ent.tags or [],
        "pain_points": ent.pain_points,
    }


# ═══════════════════════════════════════════════
#  Existing endpoints (unchanged)
# ═══════════════════════════════════════════════

@router.post("/generate-profile/{enterprise_id}")
def api_generate_profile(enterprise_id: int, db: Session = Depends(get_db)):
    """Generate enterprise profile analysis via AI (with rule-based fallback)."""
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    result = generate_profile(_ent_to_dict(ent))

    ent.pain_points = result.get("pain_points")
    ent.needs = result.get("investment_analysis")
    ent.analysis_text = result.get("summary")
    db.commit()

    return {"enterprise_id": enterprise_id, "profile": result}


@router.post("/match-policies/{enterprise_id}")
def api_match_policies(enterprise_id: int, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    policies = db.query(Policy).all()
    policy_dicts = [
        {"id": p.id, "title": p.title, "level": p.level, "category": p.category,
         "scope": p.scope, "benefit": p.benefit, "match_tags": p.match_tags or []}
        for p in policies
    ]

    result = match_resources(_ent_to_dict(ent), policy_dicts, "政策")
    return {"enterprise_id": enterprise_id, "matches": result}


@router.post("/match-properties/{enterprise_id}")
def api_match_properties(enterprise_id: int, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    properties = db.query(Property).all()
    prop_dicts = [
        {"id": p.id, "name": p.name, "type": p.type, "area": p.area,
         "price": p.price, "location": p.location, "features": p.features, "tags": p.tags or []}
        for p in properties
    ]

    result = match_resources(_ent_to_dict(ent), prop_dicts, "物业")
    return {"enterprise_id": enterprise_id, "matches": result}


@router.post("/generate-report/{enterprise_id}")
def api_generate_report(enterprise_id: int, db: Session = Depends(get_db)):
    ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Enterprise not found")

    ent_dict = _ent_to_dict(ent)
    profile = ent.pain_points or {}
    matches = {"summary": "匹配结果待生成"}

    try:
        policies = db.query(Policy).all()
        policy_dicts = [{"id": p.id, "title": p.title, "match_tags": p.match_tags or []} for p in policies]
        policy_matches = match_resources(ent_dict, policy_dicts, "政策")
        matches["policy_matches"] = policy_matches
        matches["summary"] = policy_matches.get("summary", "")
    except Exception:
        pass

    report = generate_report(ent_dict, profile, matches)

    db_report = Report(
        enterprise_id=enterprise_id,
        type="投资研判",
        title=report.get("title", f"{ent.name} 招商研判报告"),
        content=report,
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return {"report_id": db_report.id, "report": report}


# ═══════════════════════════════════════════════
#  Chat endpoint with function calling
# ═══════════════════════════════════════════════

SYSTEM_PROMPT = """你是一位专业的产业招商助手，服务于政府招商部门。你可以帮助用户：

1. **查询企业信息** — 搜索、筛选、查看企业详情
2. **分析企业价值** — 生成企业画像、投资研判
3. **匹配政策资源** — 为企业匹配合适的优惠政策
4. **匹配物业资源** — 为企业匹配合适的办公/生产空间
5. **生成研判报告** — 生成专业的招商研判报告
6. **查看产业图谱** — 查看产业链上下游结构
7. **数据统计** — 查看招商工作台统计数据
8. **新增企业** — 将新企业录入系统

回答时：
- 用简洁专业的中文
- 主动使用工具函数获取实时数据，不要编造
- 当用户问模糊问题时，主动提供筛选建议
- 可以结合多个工具函数完成复杂任务"""

# Tool definitions for DeepSeek function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_enterprises",
            "description": "搜索/筛选企业列表。可按名称、行业、状态筛选。",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "搜索关键词（匹配企业名称、行业、细分领域）"},
                    "status": {"type": "string", "description": "招商状态筛选：线索/洽谈中/已签约/已落地"},
                    "limit": {"type": "integer", "description": "返回数量上限，默认20"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_enterprise_detail",
            "description": "获取单个企业的详细信息，包括痛点分析、投资评级等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["enterprise_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_policies",
            "description": "获取政策列表，可按关键词搜索。",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "搜索关键词（匹配政策标题）"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_properties",
            "description": "获取物业/空间资源列表，可按关键词搜索。",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "搜索关键词（匹配物业名称）"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_industry_chain",
            "description": "获取产业图谱数据（产业链节点和关系）。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_stats",
            "description": "获取招商工作台统计数据：企业总数、各状态数量、行业分布等。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_enterprise_profile",
            "description": "为企业生成AI画像分析（痛点、需求、投资研判）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["enterprise_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "match_policies_for_enterprise",
            "description": "为指定企业匹配适用的政策。",
            "parameters": {
                "type": "object",
                "properties": {
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["enterprise_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "match_properties_for_enterprise",
            "description": "为指定企业匹配适用的物业资源。",
            "parameters": {
                "type": "object",
                "properties": {
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["enterprise_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report_for_enterprise",
            "description": "为指定企业生成招商研判报告。",
            "parameters": {
                "type": "object",
                "properties": {
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["enterprise_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_enterprise",
            "description": "在系统中新增一个企业。",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "企业名称"},
                    "industry": {"type": "string", "description": "所属行业"},
                    "segment": {"type": "string", "description": "细分领域"},
                    "region": {"type": "string", "description": "所在地区"},
                    "scale": {"type": "string", "description": "企业规模：大型/中型/小型"},
                    "status": {"type": "string", "description": "招商状态，默认'线索'"},
                    "contact": {"type": "string", "description": "联系人信息"},
                    "demand": {"type": "string", "description": "核心需求描述"},
                    "invest_rating": {"type": "string", "description": "投资评级：A/A-/B+/B/C"},
                    "tags": {"type": "array", "items": {"type": "string"}, "description": "标签列表"}
                },
                "required": ["name", "industry"]
            }
        }
    }
]


# ── Tool executor ──

def _execute_tool(tool_name: str, tool_args: dict) -> str:
    """Execute a tool call and return the result as a JSON string."""
    db: Session = SessionLocal()
    try:
        if tool_name == "search_enterprises":
            search = tool_args.get("search", "")
            status = tool_args.get("status", "")
            limit = tool_args.get("limit", 20)
            q = db.query(Enterprise)
            if search:
                like = f"%{search}%"
                q = q.filter(
                    (Enterprise.name.ilike(like))
                    | (Enterprise.industry.ilike(like))
                    | (Enterprise.segment.ilike(like))
                )
            if status:
                q = q.filter(Enterprise.status == status)
            items = q.order_by(Enterprise.updated_at.desc()).limit(limit).all()
            return json.dumps([_ent_to_dict(e) for e in items], ensure_ascii=False)

        elif tool_name == "get_enterprise_detail":
            eid = tool_args["enterprise_id"]
            ent = db.query(Enterprise).filter(Enterprise.id == eid).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{eid}的企业"})
            return json.dumps(_ent_to_dict(ent), ensure_ascii=False)

        elif tool_name == "list_policies":
            search = tool_args.get("search", "")
            q = db.query(Policy)
            if search:
                q = q.filter(Policy.title.ilike(f"%{search}%"))
            items = q.all()
            return json.dumps([
                {"id": p.id, "title": p.title, "level": p.level, "category": p.category,
                 "scope": p.scope, "benefit": p.benefit, "match_tags": p.match_tags or []}
                for p in items
            ], ensure_ascii=False)

        elif tool_name == "list_properties":
            search = tool_args.get("search", "")
            q = db.query(Property)
            if search:
                q = q.filter(Property.name.ilike(f"%{search}%"))
            items = q.all()
            return json.dumps([
                {"id": p.id, "name": p.name, "type": p.type, "area": p.area,
                 "price": p.price, "location": p.location, "features": p.features, "tags": p.tags or []}
                for p in items
            ], ensure_ascii=False)

        elif tool_name == "get_industry_chain":
            nodes = db.query(IndustryChainNode).all()
            edges = db.query(IndustryChainEdge).all()
            return json.dumps({
                "nodes": [{"id": n.id, "name": n.name, "layer": n.layer, "description": n.description,
                           "enterprises": n.enterprises or []} for n in nodes],
                "edges": [{"source": e.source_node_id, "target": e.target_node_id} for e in edges]
            }, ensure_ascii=False)

        elif tool_name == "get_dashboard_stats":
            total = db.query(Enterprise).count()
            by_status = {}
            for row in db.query(Enterprise.status, db.func.count(Enterprise.id)).group_by(Enterprise.status).all():
                by_status[row[0]] = row[1]
            by_industry = {}
            for row in db.query(Enterprise.industry, db.func.count(Enterprise.id)).group_by(Enterprise.industry).all():
                by_industry[row[0]] = row[1]
            return json.dumps({
                "total_enterprises": total,
                "by_status": by_status,
                "by_industry": by_industry
            }, ensure_ascii=False)

        elif tool_name == "generate_enterprise_profile":
            eid = tool_args["enterprise_id"]
            ent = db.query(Enterprise).filter(Enterprise.id == eid).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{eid}的企业"})
            result = generate_profile(_ent_to_dict(ent))
            ent.pain_points = result.get("pain_points")
            ent.needs = result.get("investment_analysis")
            ent.analysis_text = result.get("summary")
            db.commit()
            return json.dumps(result, ensure_ascii=False)

        elif tool_name == "match_policies_for_enterprise":
            eid = tool_args["enterprise_id"]
            ent = db.query(Enterprise).filter(Enterprise.id == eid).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{eid}的企业"})
            policies = db.query(Policy).all()
            policy_dicts = [
                {"id": p.id, "title": p.title, "level": p.level, "category": p.category,
                 "scope": p.scope, "benefit": p.benefit, "match_tags": p.match_tags or []}
                for p in policies
            ]
            result = match_resources(_ent_to_dict(ent), policy_dicts, "政策")
            return json.dumps(result, ensure_ascii=False)

        elif tool_name == "match_properties_for_enterprise":
            eid = tool_args["enterprise_id"]
            ent = db.query(Enterprise).filter(Enterprise.id == eid).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{eid}的企业"})
            properties = db.query(Property).all()
            prop_dicts = [
                {"id": p.id, "name": p.name, "type": p.type, "area": p.area,
                 "price": p.price, "location": p.location, "features": p.features, "tags": p.tags or []}
                for p in properties
            ]
            result = match_resources(_ent_to_dict(ent), prop_dicts, "物业")
            return json.dumps(result, ensure_ascii=False)

        elif tool_name == "generate_report_for_enterprise":
            eid = tool_args["enterprise_id"]
            ent = db.query(Enterprise).filter(Enterprise.id == eid).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{eid}的企业"})
            ent_dict = _ent_to_dict(ent)
            profile = ent.pain_points or {}
            matches = {"summary": "匹配结果待生成"}
            try:
                policies = db.query(Policy).all()
                policy_dicts = [{"id": p.id, "title": p.title, "match_tags": p.match_tags or []} for p in policies]
                policy_matches = match_resources(ent_dict, policy_dicts, "政策")
                matches["policy_matches"] = policy_matches
                matches["summary"] = policy_matches.get("summary", "")
            except Exception:
                pass
            report = generate_report(ent_dict, profile, matches)
            db_report = Report(
                enterprise_id=eid,
                type="投资研判",
                title=report.get("title", f"{ent.name} 招商研判报告"),
                content=report,
            )
            db.add(db_report)
            db.commit()
            db.refresh(db_report)
            return json.dumps({"report_id": db_report.id, **report}, ensure_ascii=False)

        elif tool_name == "create_enterprise":
            ent = Enterprise(
                name=tool_args["name"],
                industry=tool_args["industry"],
                segment=tool_args.get("segment", ""),
                region=tool_args.get("region", ""),
                scale=tool_args.get("scale", ""),
                status=tool_args.get("status", "线索"),
                contact=tool_args.get("contact", ""),
                demand=tool_args.get("demand", ""),
                invest_rating=tool_args.get("invest_rating", ""),
                tags=tool_args.get("tags", []),
            )
            db.add(ent)
            db.commit()
            db.refresh(ent)
            return json.dumps({"success": True, "enterprise": _ent_to_dict(ent)}, ensure_ascii=False)

        else:
            return json.dumps({"error": f"未知工具: {tool_name}"})

    except Exception as e:
        return json.dumps({"error": f"工具执行失败: {str(e)}"})
    finally:
        db.close()


# ── LLM client ──

def _get_llm_client():
    cfg = get_llm_config()
    if not cfg["api_key"]:
        return None
    try:
        import openai
        return openai.OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
    except ImportError:
        return None


def _call_llm_with_tools(messages: list) -> dict:
    """Call the LLM with function calling support. Returns the API response."""
    client = _get_llm_client()
    if not client:
        raise RuntimeError("未配置大模型 API Key，无法使用 AI 对话功能")

    return client.chat.completions.create(
        model=get_llm_config()["model"],
        messages=messages,
        tools=TOOLS,
        temperature=0.7,
        max_tokens=4096,
    )


# ── Streaming chat endpoint ──

@router.post("/chat")
async def api_chat(body: dict):
    """
    Conversational AI chat with function calling.
    Request: {"messages": [{"role": "user", "content": "..."}]}
    Response: Server-Sent Events (SSE) stream.
    """
    messages = body.get("messages", [])
    if not messages:
        raise HTTPException(status_code=400, detail="messages is required")

    # Inject system prompt if not present
    if not any(m.get("role") == "system" for m in messages):
        messages.insert(0, {"role": "system", "content": SYSTEM_PROMPT})

    # Check API key
    if not get_llm_config()["api_key"]:
        return StreamingResponse(
            _no_api_key_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
        )

    return StreamingResponse(
        _chat_stream(messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


async def _no_api_key_stream():
    """Stream a message when no API key is configured."""
    msg = "⚠️ 尚未配置大模型 API Key，AI 对话功能暂不可用。请前往「设置 → 大模型 API 配置」填入你的 API Key，或设置 DEEPSEEK_API_KEY 环境变量。"
    yield f"data: {json.dumps({'type': 'text', 'content': msg})}\n\n"
    yield "data: [DONE]\n\n"


async def _chat_stream(messages: list):
    """
    Main chat loop with function calling.
    Streams SSE events:
      data: {"type": "thinking", "content": "正在查询..."}
      data: {"type": "text", "content": "回答片段"}
      data: {"type": "tool_call", "name": "...", "args": {...}}
      data: {"type": "tool_result", "name": "...", "content": "..."}
      data: [DONE]
    """
    max_rounds = 5  # Prevent infinite loops

    for _ in range(max_rounds):
        try:
            resp = _call_llm_with_tools(messages)
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': f'AI 调用失败: {str(e)}'})}\n\n"
            break

        choice = resp.choices[0]
        msg = choice.message

        # If the model returns text content, stream it
        if msg.content:
            yield f"data: {json.dumps({'type': 'text', 'content': msg.content})}\n\n"

        # If the model wants to call tools
        if msg.tool_calls:
            # Add assistant message to history
            messages.append({
                "role": "assistant",
                "content": msg.content,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments}
                    }
                    for tc in msg.tool_calls
                ]
            })

            for tc in msg.tool_calls:
                tool_name = tc.function.name
                try:
                    tool_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    tool_args = {}

                # Notify frontend
                yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'args': tool_args})}\n\n"

                # Execute tool
                tool_result = _execute_tool(tool_name, tool_args)

                # Notify frontend of result
                yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'content': tool_result})}\n\n"

                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result
                })

            # Continue loop to let LLM process tool results
            continue

        # No tool calls and no content = finish
        if not msg.content and not msg.tool_calls:
            break

        # If we got here without tool calls, we're done
        if not msg.tool_calls:
            break

    yield "data: [DONE]\n\n"
