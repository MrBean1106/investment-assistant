"""
LLM Service — DeepSeek API client with graceful fallback.
Uses OpenAI-compatible API format.
"""

import os
import json
import logging

from services.llm_config import get_llm_config

logger = logging.getLogger(__name__)

_client = None
_client_sig = None


def _get_client():
    """Return an OpenAI-compatible client built from the current runtime config.

    Rebuilds the client only when the key / base URL changes, so updates made
    through the in-app Settings page take effect without a restart.
    """
    global _client, _client_sig
    cfg = get_llm_config()
    sig = (cfg["api_key"], cfg["base_url"])
    if _client is None or _client_sig != sig:
        if not cfg["api_key"]:
            return None
        try:
            import openai
            _client = openai.OpenAI(api_key=cfg["api_key"], base_url=cfg["base_url"])
            _client_sig = sig
        except ImportError:
            logger.warning("openai package not installed; LLM calls will use fallback")
            return None
    return _client


def _call_llm(system_prompt: str, user_prompt: str, response_format: str = "json_object") -> dict | None:
    """Call DeepSeek API. Returns parsed JSON or None on failure."""
    client = _get_client()
    if not client:
        logger.info("No LLM client available; using fallback")
        return None
    try:
        resp = client.chat.completions.create(
            model=get_llm_config()["model"],
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": response_format},
            temperature=0.3,
            max_tokens=4096,
        )
        content = resp.choices[0].message.content
        return json.loads(content) if content else None
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return None


# ── Prompt Templates ──────────────────────────

PROFILE_SYSTEM = """你是一位资深产业招商分析师。根据企业信息，分析企业的痛点与多维需求。

输出 JSON 格式：
{
  "summary": "企业一句话概述",
  "pain_points": {
    "招商需求": ["诉求1", "诉求2"],
    "政策需求": ["诉求1", "诉求2"],
    "物业需求": ["诉求1", "诉求2"],
    "订单需求": ["诉求1", "诉求2"],
    "融资需求": ["诉求1", "诉求2"]
  },
  "investment_analysis": {
    "rating": "A/A-/B+/B/C",
    "highlights": ["优势1", "优势2"],
    "risks": ["风险1"],
    "estimated_investment": "预估投资规模",
    "job_creation": "预计带动就业"
  }
}"""

MATCH_SYSTEM = """你是一位产业政策与物业匹配专家。
根据企业信息和可用资源列表，进行智能匹配分析。

输出 JSON 格式：
{
  "matches": [
    {
      "resource_name": "名称",
      "match_score": 85,
      "reason": "匹配理由"
    }
  ],
  "summary": "整体匹配建议"
}"""

REPORT_SYSTEM = """你是一位政府产业招商顾问。根据企业画像、匹配结果，撰写专业招商研判报告。

输出 JSON 格式：
{
  "title": "报告标题",
  "sections": [
    {"heading": "一、企业概况", "content": "..."},
    {"heading": "二、投资价值研判", "content": "..."},
    {"heading": "三、需求匹配分析", "content": "..."},
    {"heading": "四、招商建议", "content": "..."}
  ],
  "conclusion": "总结建议"
}"""


# ── Public API ────────────────────────────────

def generate_profile(enterprise: dict) -> dict:
    """Generate enterprise profile analysis. Falls back to template if no API key."""
    user_prompt = f"""企业名称：{enterprise.get('name', '')}
行业：{enterprise.get('industry', '')}
细分领域：{enterprise.get('segment', '')}
规模：{enterprise.get('scale', '')}
地区：{enterprise.get('region', '')}
核心需求：{enterprise.get('demand', '')}
标签：{', '.join(enterprise.get('tags', []))}"""

    result = _call_llm(PROFILE_SYSTEM, user_prompt)
    if result:
        return result

    # Fallback — template-based analysis
    return _fallback_profile(enterprise)


def match_resources(enterprise: dict, resources: list[dict], resource_type: str) -> dict:
    """Match enterprise with policies or properties."""
    user_prompt = f"""企业信息：
名称：{enterprise.get('name', '')}
行业：{enterprise.get('industry', '')}
细分：{enterprise.get('segment', '')}
需求：{enterprise.get('demand', '')}
标签：{', '.join(enterprise.get('tags', []))}

可用{resource_type}列表：
{json.dumps(resources, ensure_ascii=False, indent=2)}"""

    result = _call_llm(MATCH_SYSTEM, user_prompt)
    if result:
        return result

    # Fallback — keyword matching
    return _fallback_match(enterprise, resources, resource_type)


def generate_report(enterprise: dict, profile: dict, matches: dict) -> dict:
    """Generate investment assessment report."""
    user_prompt = f"""企业名称：{enterprise.get('name', '')}
行业：{enterprise.get('industry', '')}
画像分析：{json.dumps(profile, ensure_ascii=False)}
匹配结果：{json.dumps(matches, ensure_ascii=False)}"""

    result = _call_llm(REPORT_SYSTEM, user_prompt)
    if result:
        return result

    # Fallback — template report
    return _fallback_report(enterprise, profile, matches)


# ── Fallback Implementations ──────────────────

def _fallback_profile(ent: dict) -> dict:
    name = ent.get('name', '该企业')
    industry = ent.get('industry', '')
    segment = ent.get('segment', '')
    tags = ent.get('tags', [])
    demand = ent.get('demand', '')

    pain_points = {
        "招商需求": [],
        "政策需求": [],
        "物业需求": [],
        "订单需求": [],
        "融资需求": [],
    }

    # Rule-based analysis
    if "大型" in ent.get('scale', ''):
        pain_points["招商需求"].append("寻求地方政府产业基金或引导基金投资")
    pain_points["招商需求"].append(f"意向在产业集聚区设立{'研发中心' if '研发' in demand else '生产基地'}")

    if "制造" in industry or "新能源" in industry:
        pain_points["政策需求"].append("先进制造业税收优惠（增值税留抵退税）")
    if "科技" in industry or "芯片" in industry or "AI" in industry:
        pain_points["政策需求"].append("高新技术企业所得税优惠 + 研发费用加计扣除")
    if "专精特新" in tags:
        pain_points["政策需求"].append("专精特新企业培育奖励资金")
    pain_points["政策需求"].append("高层次人才引进补贴与住房保障")

    if "研发" in demand or "芯片" in industry:
        pain_points["物业需求"].append("研发办公空间 3000-5000㎡")
    if "生产" in demand or "制造" in industry:
        pain_points["物业需求"].append("标准厂房 20000-50000㎡，层高≥8m")
    if "总部" in demand:
        pain_points["物业需求"].append("总部办公空间 2000-5000㎡，CBD核心区位")

    if "汽车" in industry:
        pain_points["订单需求"].append("对接本地整车企业供应链体系")
    pain_points["订单需求"].append("拓展区域市场，对接下游客户资源")

    if "大型" in ent.get('scale', '') or "上市" in str(tags):
        pain_points["融资需求"].append("银行授信及项目贷款")
    else:
        pain_points["融资需求"].append("股权融资（B/C轮）或银行贷款")

    rating = ent.get('invest_rating', 'B+')

    return {
        "summary": f"{name}是{industry}领域{segment}环节的{'龙头' if rating == 'A' else '重要'}企业，具有{'较强' if rating in ('A', 'A-') else '一定'}的投资价值。",
        "pain_points": pain_points,
        "investment_analysis": {
            "rating": rating,
            "highlights": [f"在{segment}领域具有核心技术优势", f"属于{industry}产业链关键环节", "企业处于快速扩张期"],
            "risks": ["需关注行业周期性波动", "区域竞争激烈，需差异化政策吸引"],
            "estimated_investment": "5-15亿元（视项目规模）",
            "job_creation": "预计带动就业1000-3000人",
        },
    }


def _fallback_match(ent: dict, resources: list[dict], resource_type: str) -> dict:
    ent_tags = set(ent.get('tags', []))
    ent_demand = ent.get('demand', '')
    ent_industry = ent.get('industry', '')

    matches = []
    for r in resources:
        score = 50
        reasons = []
        r_tags = set(r.get('tags', []) + r.get('match_tags', []))

        # Tag overlap
        common = ent_tags & r_tags
        if common:
            score += len(common) * 15
            reasons.append(f"标签匹配：{', '.join(common)}")

        # Industry keyword match
        industry_kw = ent_industry[:2] if ent_industry else ''
        if industry_kw and (industry_kw in r.get('title', '') or industry_kw in r.get('name', '')
                            or industry_kw in r.get('scope', '') or industry_kw in r.get('benefit', '')):
            score += 20
            reasons.append(f"产业匹配：{ent_industry}")

        # Demand keyword match
        if resource_type == '政策':
            if '税收' in ent_demand or '优惠' in ent_demand:
                if '税收' in r.get('category', '') or '税收' in r.get('title', ''):
                    score += 15
                    reasons.append("需求匹配：税收优惠")
            if '人才' in ent_demand and '人才' in r.get('category', ''):
                score += 15
                reasons.append("需求匹配：人才政策")
        elif resource_type == '物业':
            if '研发' in ent_demand and ('研发' in r.get('type', '') or '研发' in r.get('name', '')):
                score += 20
                reasons.append("需求匹配：研发空间")
            if '生产' in ent_demand and '厂房' in r.get('type', ''):
                score += 20
                reasons.append("需求匹配：生产厂房")

        score = min(score, 98)
        matches.append({
            "resource_name": r.get('title') or r.get('name', ''),
            "resource_id": r.get('id'),
            "match_score": score,
            "reason": "；".join(reasons) if reasons else "基于产业方向综合匹配",
        })

    matches.sort(key=lambda x: x['match_score'], reverse=True)
    top = matches[:5]

    return {
        "matches": top,
        "summary": f"共匹配 {len(top)} 项{'政策' if resource_type == '政策' else '物业资源'}，"
                   f"最高匹配度 {top[0]['match_score']}%。建议优先对接高匹配度资源。",
    }


def _fallback_report(ent: dict, profile: dict, matches: dict) -> dict:
    name = ent.get('name', '')
    industry = ent.get('industry', '')
    segment = ent.get('segment', '')
    rating = profile.get('investment_analysis', {}).get('rating', ent.get('invest_rating', 'B+'))
    highlights = profile.get('investment_analysis', {}).get('highlights', [])
    est_inv = profile.get('investment_analysis', {}).get('estimated_investment', '待评估')
    jobs = profile.get('investment_analysis', {}).get('job_creation', '待评估')
    risks = profile.get('investment_analysis', {}).get('risks', [])

    return {
        "title": f"{name} 招商研判报告",
        "sections": [
            {
                "heading": "一、企业概况",
                "content": f"{name}是{industry}领域{segment}环节的重要企业。{profile.get('summary', '')}"
            },
            {
                "heading": "二、投资价值研判",
                "content": f"综合评级：{rating}。\n核心优势：{'；'.join(highlights)}。\n预计投资规模：{est_inv}。\n带动就业：{jobs}。\n需关注风险：{'；'.join(risks)}。"
            },
            {
                "heading": "三、需求匹配分析",
                "content": matches.get('summary', '（匹配结果详见资源匹配步骤）')
            },
            {
                "heading": "四、招商建议",
                "content": f"建议将{name}列为重点招商目标，给予土地、税收、人才等一揽子政策支持。安排主要领导带队拜访，推动项目尽快签约落地。同时做好上下游产业链配套对接，增强企业落地信心。"
            },
        ],
        "conclusion": f"综合研判，{name}项目投资价值{'优良' if rating in ('A', 'A-') else '较好'}，建议优先推进。",
    }
