"""Seed database with mock data for 新能源汽车产业链."""

from database import SessionLocal, init_db
from models import Enterprise, Policy, Property, IndustryChainNode, IndustryChainEdge


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
    ]
    db.add_all(enterprises)

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

    # ── Industry Chain ──────────────────────
    nodes_data = [
        ("上游-矿产资源", "上游", "锂/钴/镍矿采选", ["赣锋锂业", "华友钴业"]),
        ("上游-正极材料", "上游", "三元/磷酸铁锂", ["当升科技", "德方纳米"]),
        ("上游-负极/隔膜/电解液", "上游", "石墨负极、湿法隔膜", ["贝特瑞", "恩捷股份"]),
        ("中游-动力电池", "中游", "电芯/模组/PACK", ["宁德时代", "弗迪电池", "中创新航"]),
        ("中游-电机电控", "中游", "驱动电机/电控系统", ["汇川技术", "卧龙电驱"]),
        ("中游-智能网联", "中游", "自动驾驶/座舱/车联网", ["均胜电子", "德赛西威"]),
        ("下游-整车制造", "下游", "乘用车/商用车", ["比亚迪", "蔚来", "理想"]),
        ("下游-充电设施", "下游", "充电桩/换电站", ["特来电", "星星充电"]),
    ]
    nodes = []
    for name, layer, desc, ents in nodes_data:
        node = IndustryChainNode(name=name, layer=layer, description=desc, enterprises=ents)
        db.add(node)
        nodes.append(node)
    db.flush()

    edges_pairs = [(0, 1), (1, 2), (2, 3), (1, 3), (3, 6), (4, 6), (5, 6), (6, 7)]
    for src, tgt in edges_pairs:
        db.add(IndustryChainEdge(source_node_id=nodes[src].id, target_node_id=nodes[tgt].id))

    db.commit()
    db.close()
    print("✅ Seed data loaded: 6 enterprises, 5 policies, 4 properties, 8 chain nodes")


if __name__ == "__main__":
    seed()
