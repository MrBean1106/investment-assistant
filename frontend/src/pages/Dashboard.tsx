import { useEnterprises } from '../hooks/useEnterprises';
import { usePolicies, useProperties } from '../hooks/useResources';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: enterprises } = useEnterprises();
  const { data: policies } = usePolicies();
  const { data: properties } = useProperties();

  const totalEnterprises = enterprises?.total || 0;
  const negotiating = enterprises?.items.filter((e) => e.status === '洽谈中').length || 0;
  const signed = enterprises?.items.filter((e) => e.status === '已签约' || e.status === '已落地').length || 0;

  const stats = [
    { label: '企业总数', value: totalEnterprises, sub: '家' },
    { label: '洽谈中', value: negotiating, sub: '家' },
    { label: '已签约/落地', value: signed, sub: '家' },
    { label: '政策/物业', value: `${policies?.length || 0}/${properties?.length || 0}`, sub: '项/处' },
  ];

  const funnel = [
    { stage: '线索', count: enterprises?.items.filter((e) => e.status === '线索').length || 0 },
    { stage: '洽谈中', count: negotiating },
    { stage: '已签约', count: enterprises?.items.filter((e) => e.status === '已签约').length || 0 },
    { stage: '已落地', count: enterprises?.items.filter((e) => e.status === '已落地').length || 0 },
  ];
  const maxCount = Math.max(...funnel.map((f) => f.count), 1);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-bold mb-1">工作台</h1>
      <p className="text-[14px] text-muted mb-6">招商数据概览</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-[13px] text-muted mb-1">{s.label}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-[12px] text-muted mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="card p-5">
          <h3 className="font-semibold text-[14px] mb-4">招商漏斗</h3>
          {funnel.map((f) => (
            <div key={f.stage} className="flex items-center gap-3 mb-3">
              <span className="text-[13px] w-14 text-right text-muted">{f.stage}</span>
              <div className="flex-1 h-6 bg-[#f1f1ef] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(f.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="text-[13px] font-semibold w-6">{f.count}</span>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="card p-5">
          <h3 className="font-semibold text-[14px] mb-4">快捷操作</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/chain" className="btn btn-secondary justify-start py-3">
              <span>🔗</span> 查看产业图谱
            </Link>
            <Link to="/enterprises" className="btn btn-secondary justify-start py-3">
              <span>🏢</span> 管理企业库
            </Link>
            <Link to="/policies" className="btn btn-secondary justify-start py-3">
              <span>📜</span> 管理政策库
            </Link>
            <Link to="/properties" className="btn btn-secondary justify-start py-3">
              <span>🏗️</span> 管理物业库
            </Link>
            <Link to="/reports" className="btn btn-secondary justify-start py-3">
              <span>📄</span> 查看报告
            </Link>
            <Link to="/enterprises" className="btn btn-primary justify-start py-3">
              <span>🚀</span> 开始招商流程
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
