import { useEnterprises } from '../hooks/useEnterprises';
import { usePolicies, useProperties } from '../hooks/useResources';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: enterprises } = useEnterprises();
  const { data: policies } = usePolicies();
  const { data: properties } = useProperties();

  const total = enterprises?.total || 0;
  const negotiating = enterprises?.items.filter((e) => e.status === '洽谈中').length || 0;
  const signed = enterprises?.items.filter((e) => e.status === '已签约' || e.status === '已落地').length || 0;
  const clues = enterprises?.items.filter((e) => e.status === '线索').length || 0;

  const stats = [
    { label: '企业总数', value: total, hint: `${clues} 线索 · ${negotiating} 洽谈` },
    { label: '已签约/落地', value: signed, hint: `${total > 0 ? Math.round(signed / total * 100) : 0}% 转化率` },
    { label: '政策库', value: policies?.length || 0, hint: '国家级/省市级' },
    { label: '物业资源', value: properties?.length || 0, hint: '园区/厂房/办公' },
  ];

  const funnel = [
    { s: '线索', n: clues, c: '#94a3b8' },
    { s: '洽谈中', n: negotiating, c: '#3b82f6' },
    { s: '已签约', n: enterprises?.items.filter((e) => e.status === '已签约').length || 0, c: '#6366f1' },
    { s: '已落地', n: enterprises?.items.filter((e) => e.status === '已落地').length || 0, c: '#10b981' },
  ];
  const maxN = Math.max(...funnel.map((f) => f.n), 1);

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="page-title">工作台</h1>
      <p className="page-subtitle mb-8">招商数据概览 · {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Funnel */}
        <div className="col-span-3 card p-6">
          <h3 className="font-semibold text-[14px] mb-5" style={{ letterSpacing: '-0.01em' }}>招商漏斗</h3>
          <div className="space-y-4">
            {funnel.map((f) => (
              <div key={f.s} className="flex items-center gap-3">
                <span className="text-[12.5px] font-medium w-16 text-right" style={{ color: 'var(--color-ink-secondary)' }}>{f.s}</span>
                <div className="flex-1">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${(f.n / maxN) * 100}%`, background: f.c }} />
                  </div>
                </div>
                <span className="font-mono text-[13px] font-semibold w-8 text-right" style={{ color: f.c }}>{f.n}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="col-span-2 card p-6">
          <h3 className="font-semibold text-[14px] mb-4" style={{ letterSpacing: '-0.01em' }}>快捷操作</h3>
          <div className="space-y-2">
            {[
              { to: '/enterprises', icon: '▤', label: '管理企业库', primary: true },
              { to: '/chain', icon: '◎', label: '产业图谱', primary: false },
              { to: '/policies', icon: '▥', label: '政策库', primary: false },
              { to: '/properties', icon: '◫', label: '物业资源', primary: false },
              { to: '/reports', icon: '▣', label: '报告中心', primary: false },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={a.primary ? 'btn btn-primary w-full justify-start' : 'btn btn-secondary w-full justify-start'}
              >
                <span style={{ fontSize: 15 }}>{a.icon}</span>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
