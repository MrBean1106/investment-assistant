"""Seed database with mock data for 新能源汽车产业链."""

from datetime import date

from database import SessionLocal, init_db
from models import Enterprise, Policy, Property, IndustryChain, IndustryChainNode, IndustryChainEdge, ChainNodeEnterprise, Lead


def seed():
    init_db()
    db = SessionLocal()

    # ── Enterprises ──────────────────────────
    enterprises = [
        Enterprise(name="宁德时代新能源科技", industry="新能源汽车", segment="动力电池", region="福建宁德",
                   scale="大型", status="已落地", contact="张总 138xxxx", demand="扩产用地200亩",
                   invest_rating="A", tags=["动力电池", "上市企业", "链主"],
                   pain_points={"招商需求": ["扩大产能需新增用地200亩", "寻求地方政府产业基金投资"],
                                "政策需求": ["税收优惠（高新+先进制造）", "人才引进补贴"],
                                "物业需求": ["研发中心5000㎡", "标准厂房30000㎡"]}),
        Enterprise(name="比亚迪半导体", industry="新能源汽车", segment="车规芯片", region="广东深圳",
                   scale="大型", status="洽谈中", contact="李总 139xxxx", demand="研发中心+封测产线",
                   invest_rating="A", tags=["芯片", "IDM"]),
        Enterprise(name="均胜电子", industry="新能源汽车", segment="智能座舱", region="浙江宁波",
                   scale="中型", status="线索", contact="王总 137xxxx", demand="政策优惠+人才公寓",
                   invest_rating="B+", tags=["汽车电子", "Tier1"]),
        Enterprise(name="汇川技术", industry="智能制造", segment="工业伺服", region="广东深圳",
                   scale="大型", status="已签约", contact="赵总 136xxxx", demand="标准厂房3万㎡",
                   invest_rating="A-", tags=["工控", "上市企业"]),
        Enterprise(name="埃斯顿自动化", industry="智能制造", segment="工业机器人", region="江苏南京",
                   scale="中型", status="线索", contact="陈总 135xxxx", demand="研发场地+测试基地",
                   invest_rating="B", tags=["机器人", "专精特新"]),
        Enterprise(name="地平线机器人", industry="人工智能", segment="AI芯片", region="北京",
                   scale="中型", status="洽谈中", contact="刘总 133xxxx", demand="总部+算力中心",
                   invest_rating="A", tags=["AI芯片", "独角兽"]),
        Enterprise(name="赣锋锂业", industry="新能源汽车", segment="锂矿", region="江西新余",
                   scale="大型", status="线索", contact="李总 139xxxx", demand="扩产锂盐产能",
                   invest_rating="A-", tags=["锂矿", "上市企业"]),
        Enterprise(name="当升科技", industry="新能源汽车", segment="正极材料", region="北京",
                   scale="大型", status="线索", contact="赵总 136xxxx", demand="三元材料扩产",
                   invest_rating="B+", tags=["正极材料", "上市企业"]),
        Enterprise(name="恩捷股份", industry="新能源汽车", segment="隔膜", region="上海",
                   scale="大型", status="线索", contact="王总 137xxxx", demand="湿法隔膜产线",
                   invest_rating="A", tags=["隔膜", "上市企业"]),
        Enterprise(name="比亚迪", industry="新能源汽车", segment="整车制造", region="广东深圳",
                   scale="大型", status="已落地", contact="王总 138xxxx", demand="第二工厂选址",
                   invest_rating="A", tags=["整车", "上市企业", "链主"]),
        Enterprise(name="特来电", industry="新能源汽车", segment="充电桩", region="山东青岛",
                   scale="中型", status="线索", contact="陈总 135xxxx", demand="充电网络布局",
                   invest_rating="B+", tags=["充电桩", "独角兽"]),
    ]
    db.add_all(enterprises)
    db.flush()  # Get IDs

    # ── Policies ─────────────────────────────
    policies = [
        Policy(title="先进制造业增值税留抵退税", level="国家级", category="税收优惠",
               scope="先进制造业企业", benefit="按月全额退还增量留抵税额",
               match_tags=["制造业", "高新技术"]),
        Policy(title="专精特新企业培育奖励", level="省级", category="资金奖补",
               scope="省级专精特新企业", benefit="一次性奖励100万元",
               match_tags=["专精特新", "中小企业"]),
        Policy(title="重大产业项目用地保障", level="市级", category="土地保障",
               scope="投资超5亿元项目", benefit="优先供地，地价优惠30%",
               match_tags=["大型项目", "制造业"]),
        Policy(title="科技创新研发费用加计扣除", level="国家级", category="税收优惠",
               scope="科技型企业", benefit="研发费用100%加计扣除",
               match_tags=["研发", "科技"]),
        Policy(title="高层次人才引进住房补贴", level="市级", category="人才政策",
               scope="博士或高级职称", benefit="购房补贴最高200万",
               match_tags=["人才", "高管"]),
    ]
    db.add_all(policies)

    # ── Properties ───────────────────────────
    properties = [
        Property(name="智谷科技园A区", type="研发办公", area="5000㎡", floor="3-5层",
                 price="35元/㎡/月", location="高新区核心", features="毛坯交付，可定制",
                 tags=["研发", "办公"]),
        Property(name="临港标准厂房三期", type="生产厂房", area="30000㎡", floor="1层",
                 price="18元/㎡/月", location="临港工业区", features="层高12m，带行车",
                 tags=["生产", "厂房"]),
        Property(name="创新中心B座", type="商务办公", area="1500㎡", floor="12-15层",
                 price="55元/㎡/月", location="CBD核心区", features="精装交付，配套齐全",
                 tags=["总部", "办公"]),
        Property(name="生态科技岛1号", type="研发中试", area="8000㎡", floor="独栋",
                 price="28元/㎡/月", location="科技岛", features="花园式园区，可环评",
                 tags=["研发", "中试"]),
    ]
    db.add_all(properties)

    # ── Industry Chains ─────────────────────
    chain = IndustryChain(name="新能源汽车产业链", description="涵盖上游矿产资源、中游三电系统、下游整车及充电设施")
    db.add(chain)
    db.flush()

    nodes_data = [
        ("上游-矿产资源", "上游", "锂/钴/镍矿采选"),
        ("上游-正极材料", "上游", "三元/磷酸铁锂材料"),
        ("上游-负极/隔膜/电解液", "上游", "石墨负极、湿法隔膜、电解液"),
        ("中游-动力电池", "中游", "电芯/模组/PACK"),
        ("中游-电机电控", "中游", "驱动电机/电控系统"),
        ("中游-智能网联", "中游", "自动驾驶/座舱/车联网"),
        ("下游-整车制造", "下游", "乘用车/商用车"),
        ("下游-充电设施", "下游", "充电桩/换电站"),
    ]
    nodes = []
    for name, layer, desc in nodes_data:
        node = IndustryChainNode(chain_id=chain.id, name=name, layer=layer, description=desc)
        db.add(node)
        nodes.append(node)
    db.flush()

    # Edges: upstream→midstream→downstream
    edges_pairs = [(0,1), (1,2), (2,3), (1,3), (3,6), (4,6), (5,6), (6,7)]
    for src, tgt in edges_pairs:
        db.add(IndustryChainEdge(source_node_id=nodes[src].id, target_node_id=nodes[tgt].id))

    # Link enterprises to chain nodes
    # Map enterprise names → node index
    ent_map = {e.name: e for e in enterprises}
    node_ent_links = {
        0: ["赣锋锂业"],                # 上游-矿产资源
        1: ["当升科技"],                # 上游-正极材料
        2: ["恩捷股份"],                # 上游-负极/隔膜/电解液
        3: ["宁德时代新能源科技"],       # 中游-动力电池
        4: ["汇川技术"],                # 中游-电机电控
        5: ["均胜电子"],                # 中游-智能网联
        6: ["比亚迪"],                  # 下游-整车制造
        7: ["特来电"],                  # 下游-充电设施
    }
    for node_idx, ent_names in node_ent_links.items():
        for name in ent_names:
            ent = ent_map.get(name)
            if ent:
                db.add(ChainNodeEnterprise(node_id=nodes[node_idx].id, enterprise_id=ent.id))

    # ── Leads (招商线索) ──────────────────
    leads = [
        Lead(title="宁德时代二期扩产", enterprise_id=ent_map["宁德时代新能源科技"].id,
             company_name="宁德时代新能源科技", source="以商招商", stage="深度对接", priority="高",
             owner="张明", contact_name="张总", contact_info="138xxxx", intent_investment="50亿",
             intent_region="高新区", expected_landing_date=date(2026, 12, 31), progress=60,
             next_action="安排实地考察与用地洽谈", notes="链主项目，需重点保障用地",
             follow_ups=[{"date": "2026-07-01", "content": "首次对接，了解扩产意向", "owner": "张明"}]),
        Lead(title="比亚迪半导体封测产线", enterprise_id=ent_map["比亚迪半导体"].id,
             company_name="比亚迪半导体", source="招商推介", stage="意向洽谈", priority="高",
             owner="李华", contact_name="李总", contact_info="139xxxx", intent_investment="20亿",
             intent_region="经开区", expected_landing_date=date(2027, 6, 30), progress=35,
             next_action="对接研发中心选址", notes="关注人才公寓配套", follow_ups=[]),
        Lead(title="均胜电子区域总部", enterprise_id=ent_map["均胜电子"].id,
             company_name="均胜电子", source="主动挖掘", stage="初步接触", priority="中",
             owner="王芳", contact_name="王总", contact_info="137xxxx", intent_investment="8亿",
             intent_region="高新区", progress=10, next_action="电话拜访了解意向", follow_ups=[]),
        Lead(title="远景储能科技新设基地", enterprise_id=None,
             company_name="远景储能科技", source="展会", stage="初步接触", priority="中",
             owner="张明", contact_name="陈总", contact_info="135xxxx", intent_investment="12亿",
             intent_region="临港", progress=5, next_action="收集企业资料", follow_ups=[]),
    ]
    db.add_all(leads)

    db.commit()
    db.close()
    print("✅ Seed data loaded: 11 enterprises, 5 policies, 4 properties, 1 chain (8 nodes), 4 leads")


if __name__ == "__main__":
    seed()
