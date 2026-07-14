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
from models import Enterprise, Policy, Property, IndustryChain, IndustryChainNode, IndustryChainEdge, ChainNodeEnterprise, Report
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
8. **新增企业** — 将新企业录入系统（企业库）
9. **关联产业图谱** — 把企业挂到产业图谱的对应节点上

【重要：新增企业 / 关联产业图谱的规则】
- 当用户要求“把企业加到企业库 / 录入 / 登记 / 添加企业”，或要求“加到产业图谱”时，**必须按顺序执行真实工具调用**，不要只在文字里答应或编造。
- **标准流程**：
  1. 从用户消息和上传文件内容中提取企业名称（name）、行业（industry）、地区（region）、规模（scale）、联系人（contact）、核心需求（demand）、主营业务等关键参数；
  2. 用 `search_enterprises` 查询是否已存在；
  3. 若不存在，**立即调用 `create_enterprise` 写入企业库**，并拿到返回的 enterprise_id；
  4. 若用户还要求加入产业图谱，则查看现有产业图谱节点，选择最匹配的节点（或创建新节点），然后调用 `add_enterprise_to_industry_chain` 把企业和节点关联；
  5. 全部完成后，用一句话总结：“已为你录入企业《X》（ID: N）并关联到产业图谱节点《Y》，可在左侧「企业库」/「产业图谱」查看”。
- 企业名称（name）必填；行业（industry）尽量填写，实在不知道可填“未分类”。其余字段能收集到就一并写入。
- 如果企业已存在（先用 search 查到），就不要重复创建，但**仍可在用户要求时把它关联到产业图谱**。
- **严禁在没有实际成功调用工具并拿到返回数据的情况下，声称“已添加/已录入/已加入企业库/已在库中/已关联产业图谱”。** 只有工具返回 success/linked 等确认时才能确认成功；若工具失败或未调用，必须如实告知用户并重试或说明原因，绝不能虚构成功。
- **严禁在 search_enterprises 返回为空、或没有成功调用 get_enterprise_detail 的情况下，编造“企业已在库中（ID: XX）”之类的结果。** 若不确定，请重新搜索或调用 create_enterprise，不要臆测。
- 上传文件时：系统已自动提取文件内容并放在用户消息中。若文件解析为空或失败，请依据文件名和可识别的片段推断；若完全无法提取企业名，请向用户追问，不要编造。

回答时：
- 用简洁专业的中文
- 主动使用工具函数获取/写入实时数据，不要编造数据
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
    },
    {
        "type": "function",
        "function": {
            "name": "search_industry_chain_nodes",
            "description": "搜索产业图谱中的节点，可按所属产业链和关键词匹配节点名称。",
            "parameters": {
                "type": "object",
                "properties": {
                    "chain_id": {"type": "integer", "description": "产业链ID（可选，不填则搜索全部节点）"},
                    "search": {"type": "string", "description": "节点名称关键词（可选）"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_industry_chain_node",
            "description": "在指定产业链下新增一个节点（上游/中游/下游）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "chain_id": {"type": "integer", "description": "产业链ID"},
                    "name": {"type": "string", "description": "节点名称"},
                    "layer": {"type": "string", "description": "节点层级：上游/中游/下游"},
                    "description": {"type": "string", "description": "节点描述"}
                },
                "required": ["chain_id", "name", "layer"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_enterprise_to_industry_chain",
            "description": "把一个已存在的企业关联到产业图谱的某个节点。若节点不存在，请先 create_industry_chain_node。",
            "parameters": {
                "type": "object",
                "properties": {
                    "chain_id": {"type": "integer", "description": "产业链ID"},
                    "node_id": {"type": "integer", "description": "节点ID"},
                    "enterprise_id": {"type": "integer", "description": "企业ID"}
                },
                "required": ["chain_id", "node_id", "enterprise_id"]
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
            # 企业与节点的关联保存在 ChainNodeEnterprise 关联表，不在节点对象上
            links = db.query(ChainNodeEnterprise).all()
            ent_names = {e.id: e.name for e in db.query(Enterprise).all()}
            node_ents: dict = {}
            for link in links:
                node_ents.setdefault(link.node_id, []).append(
                    ent_names.get(link.enterprise_id, f"企业{link.enterprise_id}")
                )
            return json.dumps({
                "nodes": [{
                    "id": n.id, "name": n.name, "layer": n.layer,
                    "description": n.description,
                    "enterprises": node_ents.get(n.id, []),
                } for n in nodes],
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
            name = (tool_args.get("name") or "").strip()
            if not name:
                return json.dumps({"error": "缺少企业名称（name），无法新增企业"})
            industry = (tool_args.get("industry") or "").strip() or "未分类"
            ent = Enterprise(
                name=name,
                industry=industry,
                segment=tool_args.get("segment", "") or "",
                region=tool_args.get("region", "") or "",
                scale=tool_args.get("scale", "") or "",
                status=tool_args.get("status", "") or "线索",
                contact=tool_args.get("contact", "") or "",
                demand=tool_args.get("demand", "") or "",
                invest_rating=tool_args.get("invest_rating", "") or "",
                tags=tool_args.get("tags", []) or [],
            )
            db.add(ent)
            db.commit()
            db.refresh(ent)
            return json.dumps({
                "success": True,
                "enterprise_id": ent.id,
                "enterprise": _ent_to_dict(ent),
            }, ensure_ascii=False)

        elif tool_name == "search_industry_chain_nodes":
            chain_id = tool_args.get("chain_id")
            search = (tool_args.get("search") or "").strip()
            q = db.query(IndustryChainNode)
            if chain_id:
                q = q.filter(IndustryChainNode.chain_id == chain_id)
            if search:
                like = f"%{search}%"
                q = q.filter(IndustryChainNode.name.ilike(like))
            nodes = q.order_by(IndustryChainNode.id).all()
            chains = {c.id: c.name for c in db.query(IndustryChain).all()}
            return json.dumps([{
                "id": n.id,
                "chain_id": n.chain_id,
                "chain_name": chains.get(n.chain_id, ""),
                "name": n.name,
                "layer": n.layer,
                "description": n.description or "",
            } for n in nodes], ensure_ascii=False)

        elif tool_name == "create_industry_chain_node":
            chain_id = tool_args.get("chain_id")
            name = (tool_args.get("name") or "").strip()
            layer = (tool_args.get("layer") or "").strip()
            description = (tool_args.get("description") or "").strip()
            if not chain_id or not name or not layer:
                return json.dumps({"error": "产业链ID、节点名称、层级均必填"})
            chain = db.query(IndustryChain).filter(IndustryChain.id == chain_id).first()
            if not chain:
                return json.dumps({"error": f"未找到ID为{chain_id}的产业链"})
            node = IndustryChainNode(
                chain_id=chain_id,
                name=name,
                layer=layer,
                description=description or None,
            )
            db.add(node)
            db.commit()
            db.refresh(node)
            return json.dumps({
                "success": True,
                "node_id": node.id,
                "node": {"id": node.id, "name": node.name, "layer": node.layer, "chain_id": node.chain_id},
            }, ensure_ascii=False)

        elif tool_name == "add_enterprise_to_industry_chain":
            chain_id = tool_args.get("chain_id")
            node_id = tool_args.get("node_id")
            enterprise_id = tool_args.get("enterprise_id")
            if not chain_id or not node_id or not enterprise_id:
                return json.dumps({"error": "chain_id、node_id、enterprise_id 均必填"})
            node = db.query(IndustryChainNode).filter(
                IndustryChainNode.id == node_id,
                IndustryChainNode.chain_id == chain_id,
            ).first()
            if not node:
                return json.dumps({"error": f"未找到产业链{chain_id}下ID为{node_id}的节点"})
            ent = db.query(Enterprise).filter(Enterprise.id == enterprise_id).first()
            if not ent:
                return json.dumps({"error": f"未找到ID为{enterprise_id}的企业"})
            existing = db.query(ChainNodeEnterprise).filter(
                ChainNodeEnterprise.node_id == node_id,
                ChainNodeEnterprise.enterprise_id == enterprise_id,
            ).first()
            if existing:
                return json.dumps({
                    "status": "already_linked",
                    "node_id": node_id,
                    "enterprise_id": enterprise_id,
                }, ensure_ascii=False)
            link = ChainNodeEnterprise(node_id=node_id, enterprise_id=enterprise_id)
            db.add(link)
            db.commit()
            return json.dumps({
                "success": True,
                "status": "linked",
                "node_id": node_id,
                "enterprise_id": enterprise_id,
                "node_name": node.name,
                "enterprise_name": ent.name,
            }, ensure_ascii=False)

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
        temperature=0.2,
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

    防幻觉闸：若模型声称“已添加企业”但实际并未真正调用 create_enterprise
    （DeepSeek 可能仅凭系统提示模板口头编出“已录入《X》(ID:N)”而不执行工具），
    则强制其再走一轮工具调用，直到企业真正落库；若仍调不动，则如实告知用户，
    绝不让“声称成功”与“实际未写入”不一致。
    """
    import re
    _ADDED_RE = re.compile(
        r"(已录入|已为你录入|为你录入|已添加|已为你添加|为你添加|"
        r"已创建|已为你创建|为你创建|已新增|为你新增|"
        r"加入(了)?企业库|录入(了)?企业|录入(了)?系统|加入(了)?系统|"
        r"已加入|已成功添加|写入(了)?企业库|"
        r"已在库中|企业已存在|已存在|已在系统|已关联|已关联产业图谱|已挂到|已加入产业图谱)"
    )

    max_rounds = 7  # 留足空间给“防幻觉”强制重试
    created_enterprise = False
    linked_industry_chain = False
    last_text = ""

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
            last_text = msg.content

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

                # Track successful operations
                if tool_name == "create_enterprise":
                    try:
                        if json.loads(tool_result).get("success"):
                            created_enterprise = True
                    except (json.JSONDecodeError, TypeError):
                        pass

                if tool_name == "add_enterprise_to_industry_chain":
                    try:
                        res = json.loads(tool_result)
                        if res.get("success") or res.get("status") == "already_linked":
                            linked_industry_chain = True
                    except (json.JSONDecodeError, TypeError):
                        pass

                # Add tool result to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": tool_result
                })

            # Continue loop to let LLM process tool results
            continue

        # ---- 没有工具调用：检查是否“口头声称已添加”却没真调工具 ----
        if (not (created_enterprise or linked_industry_chain)) and _ADDED_RE.search(last_text or ""):
            # 防幻觉：强制模型下一轮用工具完成真实操作或核实
            messages.append({
                "role": "user",
                "content": (
                    "【重要指令】你刚才的回复声称已经把企业添加进「企业库」或「产业图谱」，或声称企业「已在库中」，"
                    "但你并没有让我看到对应的工具调用成功返回。"
                    "请立即调用合适的工具完成真实操作或核实："
                    "search_enterprises / get_enterprise_detail 核实是否存在，"
                    "create_enterprise 真正新增，"
                    "add_enterprise_to_industry_chain 关联产业图谱。"
                    "如果缺少企业名称等必要信息，请向我追问，绝对不要编造任何成功结果或企业ID。"
                ),
            })
            continue  # 再走一轮，逼模型真正调工具

        # 正常结束（无工具调用且未虚假声称）
        break

    # 循环结束后兜底：若仍虚假声称且未真正创建/关联，如实告知，绝不说谎
    if (not (created_enterprise or linked_industry_chain)) and _ADDED_RE.search(last_text or ""):
        honest = (
            "\n\n⚠️ 抱歉，我刚才的回复有误——企业其实并未真正写入「企业库」或关联「产业图谱」"
            "（系统未生成对应记录）。你可以：\n"
            "1）前往「企业库」页面手动「新增」该企业；\n"
            "2）在这里重新明确告诉我：“请把《企业名》加入企业库并关联产业图谱，行业是XX，地区是XX”，"
            "我会真正调用工具完成。"
        )
        yield f"data: {json.dumps({'type': 'text', 'content': honest})}\n\n"

    yield "data: [DONE]\n\n"
