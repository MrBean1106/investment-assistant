import { useIndustryChain } from '../hooks/useResources';
import ReactECharts from 'echarts-for-react';
import { useState } from 'react';

const LAYER_COLORS: Record<string, string> = {
  '上游': '#f59e0b',
  '中游': '#3b82f6',
  '下游': '#10b981',
};

export default function IndustryChain() {
  const { data, isLoading, error } = useIndustryChain();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  if (isLoading) return <div className="p-8 text-center text-muted">⏳ 加载产业链数据...</div>;
  if (error) return <div className="p-8 text-red-500">加载失败：{error.message}</div>;
  if (!data) return null;

  const selected = data.nodes.find((n) => n.name === selectedNode);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (params: { data: { name: string; layer: string; desc: string; enterprises: string[] } }) => {
        const d = params.data;
        if (!d?.enterprises) return d?.name || '';
        return `<b>${d.name}</b><br/>层级：${d.layer || ''}<br/>${d.desc || ''}<br/>企业：${(d.enterprises || []).join('、')}`;
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        force: { repulsion: 400, edgeLength: [150, 350], gravity: 0.08 },
        label: { show: true, fontSize: 11, color: '#333', position: 'right', formatter: '{b}' },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 8,
        lineStyle: { color: '#c0c0c0', curveness: 0.1 },
        data: data.nodes.map((n) => ({
          name: n.name,
          symbolSize: 40,
          itemStyle: { color: LAYER_COLORS[n.layer] || '#999' },
          category: n.layer,
          desc: n.description,
          enterprises: n.enterprises,
          layer: n.layer,
        })),
        links: data.edges.map((e) => {
          const src = data.nodes.find((n) => n.id === e.source_node_id);
          const tgt = data.nodes.find((n) => n.id === e.target_node_id);
          return { source: src?.name || '', target: tgt?.name || '' };
        }),
        categories: Object.entries(LAYER_COLORS).map(([name, color]) => ({ name, itemStyle: { color } })),
      },
    ],
  };

  const onEvents = {
    click: (params: { data?: { name: string } }) => {
      if (params.data?.name) setSelectedNode(params.data.name);
    },
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-1">产业图谱</h1>
      <p className="text-[14px] text-muted mb-1">新能源汽车产业链 · 上下游关系</p>

      {/* Legend */}
      <div className="flex gap-4 mb-4">
        {Object.entries(LAYER_COLORS).map(([layer, color]) => (
          <div key={layer} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color }} />
            {layer}
          </div>
        ))}
        <span className="text-[12px] text-muted ml-2">拖拽节点 · 滚轮缩放 · 点击查看详情</span>
      </div>

      {/* Graph */}
      <div className="card p-2 mb-4" style={{ height: '480px' }}>
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          onEvents={onEvents}
          opts={{ renderer: 'canvas' }}
        />
      </div>

      {/* Selected Node Detail */}
      {selected && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-semibold text-[15px]">{selected.name}</span>
              <span
                className="tag ml-2 text-[11px]"
                style={{ backgroundColor: (LAYER_COLORS[selected.layer] || '#999') + '20', color: LAYER_COLORS[selected.layer] }}
              >
                {selected.layer}
              </span>
            </div>
            <button className="text-muted hover:text-ink text-sm" onClick={() => setSelectedNode(null)}>✕ 关闭</button>
          </div>
          <p className="text-[13px] text-muted mb-3">{selected.description}</p>
          <h4 className="text-[13px] font-semibold mb-2">关联企业</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {selected.enterprises.map((e) => (
              <div key={e} className="card p-3 text-center">
                <div className="text-[13px] font-medium">{e}</div>
                <div className="text-[11px] text-muted mt-0.5">查看企业画像 →</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
