import ReactECharts from 'echarts-for-react';
import { useStats } from '../hooks/useStats';
import { Link, useNavigate } from 'react-router-dom';
import type { EChartsOption } from 'echarts';

// Semantic palettes aligned with the design system
const STATUS_COLORS: Record<string, string> = {
  线索: '#94a3b8',
  洽谈中: '#3b82f6',
  已签约: '#6366f1',
  已落地: '#10b981',
};
const CATEGORY_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
const RATING_COLORS: Record<string, string> = {
  A: '#10b981',
  'A-': '#34d399',
  'B+': '#f59e0b',
  B: '#fbbf24',
  C: '#ef4444',
};
const RATING_ORDER = ['A', 'A-', 'B+', 'B', 'C'];

function ratingTagClass(rating: string | null): string {
  switch (rating) {
    case 'A': return 'tag tag-green';
    case 'A-': return 'tag tag-green';
    case 'B+': return 'tag tag-blue';
    case 'B': return 'tag tag-orange';
    default: return 'tag tag-gray';
  }
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-[14px]" style={{ letterSpacing: '-0.01em' }}>{title}</h3>
        {subtitle && <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const navigate = useNavigate();

  const total = stats?.total_enterprises ?? 0;
  const signed = stats?.signed_or_landed ?? 0;
  const convRate = stats?.conversion_rate ?? 0;
  const negotiating = stats?.by_status?.['洽谈中'] ?? 0;
  const clues = stats?.by_status?.['线索'] ?? 0;

  const statCards = [
    { label: '企业总数', value: total, hint: `${clues} 线索 · ${negotiating} 洽谈`, to: '/enterprises', accent: 'var(--color-accent)' },
    { label: '已签约/落地', value: signed, hint: `${convRate}% 转化率`, to: '/enterprises?status=已签约', accent: 'var(--color-success)' },
    { label: '政策库', value: stats?.total_policies ?? 0, hint: '国家级/省市级', to: '/policies', accent: '#8b5cf6' },
    { label: '物业资源', value: stats?.total_properties ?? 0, hint: '园区/厂房/办公', to: '/properties', accent: '#f59e0b' },
  ];

  // ── Funnel chart ──
  const funnelData = (stats?.funnel ?? []).map((f) => ({
    name: f.stage,
    value: f.count,
    itemStyle: { color: STATUS_COLORS[f.stage] || '#94a3b8' },
  }));

  const funnelOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 家 ({d}%)' },
    series: [{
      type: 'funnel',
      left: '8%',
      right: '8%',
      top: 8,
      bottom: 8,
      minSize: '28%',
      gap: 2,
      label: { show: true, position: 'inside', fontSize: 12, fontWeight: 600, color: '#fff' },
      labelLine: { show: false },
      data: funnelData,
    }],
  };

  // ── Industry pie ──
  const industryData = Object.entries(stats?.by_industry ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const industryOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} 家 ({d}%)' },
    legend: { orient: 'vertical', right: 6, top: 'center', textStyle: { fontSize: 11, color: '#475569' }, itemWidth: 10, itemHeight: 10 },
    color: CATEGORY_PALETTE,
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['38%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 13, fontWeight: 700 }, scaleSize: 6 },
      data: industryData,
    }],
  };

  // ── Rating bar ──
  const ratingEntries = RATING_ORDER
    .filter((r) => (stats?.by_rating?.[r] ?? 0) > 0)
    .map((r) => ({ rating: r, count: stats?.by_rating?.[r] ?? 0 }));

  const ratingOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} 家' },
    grid: { left: 8, right: 24, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: ratingEntries.map((e) => e.rating), axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#475569', fontSize: 12, fontWeight: 600 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    series: [{
      type: 'bar',
      barWidth: '46%',
      data: ratingEntries.map((e) => ({ value: e.count, itemStyle: { color: RATING_COLORS[e.rating], borderRadius: [6, 6, 0, 0] } })),
      label: { show: true, position: 'top', color: '#475569', fontSize: 11, fontWeight: 600 },
    }],
  };

  // ── Region horizontal bar ──
  const regionEntries = Object.entries(stats?.by_region ?? {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => a.value - b.value) // asc so largest on top
    .slice(-8);

  const regionOption: EChartsOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} 家' },
    grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    yAxis: { type: 'category', data: regionEntries.map((e) => e.name), axisLine: { lineStyle: { color: '#e2e8f0' } }, axisLabel: { color: '#475569', fontSize: 11.5 } },
    series: [{
      type: 'bar',
      barWidth: '56%',
      data: regionEntries.map((e) => ({ value: e.value, itemStyle: { color: '#3b82f6', borderRadius: [0, 6, 6, 0] } })),
      label: { show: true, position: 'right', color: '#475569', fontSize: 11, fontWeight: 600 },
    }],
  };

  const loadingHint = <div className="h-[220px] flex items-center justify-center text-[13px]" style={{ color: 'var(--color-muted)' }}>加载中…</div>;

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="page-title">工作台</h1>
      <p className="page-subtitle mb-7">招商数据概览 · {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <Link key={s.label} to={s.to} className="stat-card block transition-transform hover:-translate-y-0.5" style={{ textDecoration: 'none' }}>
            <div className="stat-value" style={{ color: s.accent }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{s.hint}</div>
          </Link>
        ))}
      </div>

      {/* Row 1: Funnel + Industry */}
      <div className="grid grid-cols-5 gap-5 mb-5">
        <div className="col-span-2">
          <ChartCard title="招商漏斗" subtitle={`${total} 家企业`}>
            {isLoading ? loadingHint : <ReactECharts option={funnelOption} style={{ height: 220 }} />}
          </ChartCard>
        </div>
        <div className="col-span-3">
          <ChartCard title="企业行业分布" subtitle="按所属行业">
            {isLoading ? loadingHint : <ReactECharts option={industryOption} style={{ height: 220 }} />}
          </ChartCard>
        </div>
      </div>

      {/* Row 2: Rating + Region */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <ChartCard title="投资评级分布" subtitle="A → C">
          {isLoading ? loadingHint : <ReactECharts option={ratingOption} style={{ height: 200 }} />}
        </ChartCard>
        <ChartCard title="地区分布" subtitle="Top 8">
          {isLoading ? loadingHint : <ReactECharts option={regionOption} style={{ height: 200 }} />}
        </ChartCard>
      </div>

      {/* Recent enterprises */}
      <ChartCard title="近期更新企业" subtitle="最近 6 条">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>企业</th>
                <th>行业</th>
                <th>地区</th>
                <th>状态</th>
                <th>评级</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recent_enterprises ?? []).map((e) => (
                <tr key={e.id} className="cursor-pointer" onClick={() => navigate(`/enterprises/${e.id}`)}>
                  <td className="font-medium" style={{ color: 'var(--color-ink)' }}>{e.name}</td>
                  <td>{e.industry || '—'}</td>
                  <td style={{ color: 'var(--color-ink-secondary)' }}>{e.region || '—'}</td>
                  <td><span className="tag" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent-dark)' }}>{e.status || '—'}</span></td>
                  <td><span className={ratingTagClass(e.invest_rating)}>{e.invest_rating || '—'}</span></td>
                </tr>
              ))}
              {!isLoading && (stats?.recent_enterprises ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-6" style={{ color: 'var(--color-muted)' }}>暂无企业数据，去 <Link to="/enterprises" className="text-blue-500">企业库</Link> 添加</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
