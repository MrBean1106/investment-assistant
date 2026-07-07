import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { api } from '../api/client';
import { chainApi } from '../api/resources';
import Modal from '../components/Modal';
import type { ChainNode } from '../types';

const LAYER_COLORS: Record<string, string> = { '上游': '#f59e0b', '中游': '#3b82f6', '下游': '#10b981' };

interface AvailEnt { id: number; name: string; industry: string; segment: string; }

export default function IndustryChain() {
  const qc = useQueryClient();

  // ── State ──
  const [chainId, setChainId] = useState<number | null>(null);
  const [selNode, setSelNode] = useState<ChainNode | null>(null);
  const [showAddChain, setShowAddChain] = useState(false);
  const [showEditChain, setShowEditChain] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showEditNode, setShowEditNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [showLinkEnt, setShowLinkEnt] = useState(false);
  const [chainForm, setChainForm] = useState({ name: '', description: '' });
  const [nodeForm, setNodeForm] = useState({ name: '', layer: '中游', description: '' });
  const [edgeForm, setEdgeForm] = useState({ source: '', target: '' });
  const [entSearch, setEntSearch] = useState('');

  // ── Queries ──
  const { data: chains } = useQuery({ queryKey: ['chains'], queryFn: () => chainApi.list() });
  const { data: chainData, isLoading } = useQuery({
    queryKey: ['chain', chainId],
    queryFn: () => chainApi.getFull(chainId!),
    enabled: !!chainId,
  });
  const { data: availEnts } = useQuery({
    queryKey: ['availEnts'],
    queryFn: () => api.get<AvailEnt[]>('/industry-chain/available-enterprises'),
  });

  // Auto-select first chain
  useEffect(() => {
    if (chains && chains.length > 0 && !chainId) {
      setChainId(chains[0].id);
    }
  }, [chains, chainId]);

  const chain = chainData?.chain;
  const nodes = chainData?.nodes || [];
  const edges = chainData?.edges || [];

  // ── Chain CRUD ──
  const handleCreateChain = async () => {
    if (!chainForm.name) return;
    const c = await chainApi.create(chainForm);
    qc.invalidateQueries({ queryKey: ['chains'] });
    setShowAddChain(false);
    setChainForm({ name: '', description: '' });
    setChainId(c.id);
  };

  const handleUpdateChain = async () => {
    if (!chainId || !chainForm.name) return;
    await chainApi.update(chainId, chainForm);
    qc.invalidateQueries({ queryKey: ['chains'] });
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
    setShowEditChain(false);
  };

  const handleDeleteChain = async () => {
    if (!chainId || !confirm(`确定删除产业链「${chain?.name}」及其所有节点、连线、企业关联？`)) return;
    await chainApi.delete(chainId);
    qc.invalidateQueries({ queryKey: ['chains'] });
    setChainId(null);
    setSelNode(null);
  };

  // ── Node CRUD ──
  const handleAddNode = async () => {
    if (!chainId || !nodeForm.name) return;
    await chainApi.createNode(chainId, nodeForm);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
    setShowAddNode(false);
    setNodeForm({ name: '', layer: '中游', description: '' });
  };

  const handleUpdateNode = async () => {
    if (!chainId || !selNode || !nodeForm.name) return;
    await chainApi.updateNode(chainId, selNode.id, nodeForm);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
    setShowEditNode(false);
    setSelNode(null);
  };

  const handleDeleteNode = async (nodeId: number) => {
    if (!chainId || !confirm('确定删除该节点及关联连线和企业？')) return;
    await chainApi.deleteNode(chainId, nodeId);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
    setSelNode(null);
  };

  // ── Edge CRUD ──
  const handleAddEdge = async () => {
    if (!chainId || !edgeForm.source || !edgeForm.target) return;
    await chainApi.createEdge(chainId, {
      source_node_id: Number(edgeForm.source),
      target_node_id: Number(edgeForm.target),
    });
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
    setShowAddEdge(false);
    setEdgeForm({ source: '', target: '' });
  };

  const handleDeleteEdge = async (edgeId: number) => {
    if (!chainId) return;
    await chainApi.deleteEdge(chainId, edgeId);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
  };

  // ── Enterprise linking ──
  const handleLinkEnt = async (entId: number) => {
    if (!chainId || !selNode) return;
    await chainApi.linkEnterprise(chainId, selNode.id, entId);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
  };

  const handleUnlinkEnt = async (entId: number) => {
    if (!chainId || !selNode) return;
    await chainApi.unlinkEnterprise(chainId, selNode.id, entId);
    qc.invalidateQueries({ queryKey: ['chain', chainId] });
  };

  // ── ECharts option ──
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (p: { data: { name: string; layer: string; desc: string; entCount: number } }) => {
        const d = p.data;
        return `<b>${d.name}</b><br/>${d.layer}<br/>${d.desc || ''}<br/>企业：${d.entCount} 家`;
      },
    },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      force: { repulsion: 400, edgeLength: [150, 350], gravity: 0.08 },
      label: { show: true, fontSize: 11, color: '#333', position: 'right' },
      edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 8,
      lineStyle: { color: '#c0c0c0', curveness: 0.1 },
      data: nodes.map(n => ({
        name: n.name,
        symbolSize: 40 + (n.enterprises?.length || 0) * 5,
        itemStyle: { color: LAYER_COLORS[n.layer] || '#999' },
        desc: n.description,
        entCount: n.enterprises?.length || 0,
        layer: n.layer,
      })),
      links: edges.map(e => ({
        source: nodes.find(n => n.id === e.source_node_id)?.name || '',
        target: nodes.find(n => n.id === e.target_node_id)?.name || '',
      })),
      categories: Object.entries(LAYER_COLORS).map(([n, c]) => ({ name: n, itemStyle: { color: c } })),
    }],
  };

  const onEvents = {
    click: (p: { data?: { name: string } }) => {
      if (p.data?.name) {
        const node = nodes.find(n => n.name === p.data!.name);
        setSelNode(node || null);
      }
    },
  };

  // ── Filter available enterprises (not already linked) ──
  const linkedEntIds = new Set(selNode?.enterprises?.map(e => e.id) || []);
  const filteredAvail = (availEnts || []).filter(e =>
    !linkedEntIds.has(e.id) &&
    (!entSearch || e.name.includes(entSearch) || (e.industry || '').includes(entSearch))
  );

  // ── Render ──
  if (!chains || chains.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">产业图谱</h1>
            <p className="page-subtitle">暂无产业链，请创建一个</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setChainForm({ name: '', description: '' }); setShowAddChain(true); }}>
            ＋ 新建产业链
          </button>
        </div>
        <div className="card p-12 text-center" style={{ color: 'var(--color-muted)' }}>
          点击上方按钮创建第一条产业链
        </div>
        <ChainFormModal open={showAddChain} title="新建产业链" form={chainForm}
          setName={(v) => setChainForm(p => ({ ...p, name: v }))}
          setDesc={(v) => setChainForm(p => ({ ...p, description: v }))}
          onClose={() => setShowAddChain(false)} onConfirm={handleCreateChain} />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* ── Chain Selector Bar ── */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="page-title">产业图谱</h1>
          <p className="page-subtitle">{nodes.length} 节点 · {edges.length} 连线</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input text-[13px] py-1.5"
            value={chainId || ''}
            onChange={e => { setChainId(Number(e.target.value)); setSelNode(null); }}
          >
            {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn btn-secondary text-[12px]" onClick={() => { setChainForm({ name: '', description: '' }); setShowAddChain(true); }}>
            ＋ 新建
          </button>
          <button className="btn btn-ghost text-[12px]" onClick={() => {
            if (!chain) return;
            setChainForm({ name: chain.name, description: chain.description || '' });
            setShowEditChain(true);
          }}>✎ 编辑</button>
          <button className="btn btn-ghost text-[12px]" style={{ color: 'var(--color-danger)' }}
            onClick={handleDeleteChain}>🗑 删除</button>
        </div>
      </div>

      {chain?.description && (
        <p className="text-[12px] mb-3" style={{ color: 'var(--color-muted)' }}>{chain.description}</p>
      )}

      {/* ── Node/Edge action buttons ── */}
      <div className="flex gap-2 mb-4">
        <button className="btn btn-secondary text-[12px]" onClick={() => { setNodeForm({ name: '', layer: '中游', description: '' }); setShowAddNode(true); }}>
          ＋ 新增节点
        </button>
        <button className="btn btn-secondary text-[12px]" onClick={() => { setEdgeForm({ source: '', target: '' }); setShowAddEdge(true); }}>
          ＋ 新增连线
        </button>
        <div className="flex gap-1.5 ml-4 items-center">
          {Object.entries(LAYER_COLORS).map(([l, c]) => (
            <div key={l} className="flex items-center gap-1 text-[12px]" style={{ color: 'var(--color-muted)' }}>
              <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c }} />{l}
            </div>
          ))}
          <span className="text-[12px] ml-1" style={{ color: 'var(--color-muted)' }}>拖拽缩放</span>
        </div>
      </div>

      {/* ── Graph ── */}
      {isLoading ? (
        <div className="card p-12 text-center" style={{ color: 'var(--color-muted)' }}>⏳ 加载图谱...</div>
      ) : (
        <div className="card p-2 mb-4" style={{ height: 480 }}>
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} onEvents={onEvents} opts={{ renderer: 'canvas' }} />
        </div>
      )}

      {/* ── Selected Node Detail ── */}
      {selNode && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-bold text-[15px]">{selNode.name}</span>
              <span className="tag ml-2" style={{ backgroundColor: (LAYER_COLORS[selNode.layer] || '#999') + '20', color: LAYER_COLORS[selNode.layer] }}>
                {selNode.layer}
              </span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost text-[12px]" onClick={() => setShowLinkEnt(true)}>＋ 关联企业</button>
              <button className="btn btn-ghost text-[12px]" onClick={() => {
                setNodeForm({ name: selNode.name, layer: selNode.layer, description: selNode.description || '' });
                setShowEditNode(true);
              }}>✎ 编辑</button>
              <button className="btn btn-ghost text-[12px]" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteNode(selNode.id)}>
                🗑 删除
              </button>
              <button className="text-lg leading-none" style={{ color: 'var(--color-muted)' }} onClick={() => setSelNode(null)}>×</button>
            </div>
          </div>
          <p className="text-[13px] mb-3" style={{ color: 'var(--color-ink-secondary)' }}>{selNode.description}</p>

          {/* Linked enterprises */}
          <h4 className="text-[13px] font-semibold mb-2">
            关联企业（{selNode.enterprises?.length || 0}家）
          </h4>
          <div className="flex flex-wrap gap-2">
            {selNode.enterprises?.map(e => (
              <span key={e.id} className="tag tag-blue flex items-center gap-1">
                {e.name}
                {e.segment && <span className="text-[10px] opacity-70">({e.segment})</span>}
                <button className="text-[10px] hover:text-red-500 ml-0.5" onClick={() => handleUnlinkEnt(e.id)}>×</button>
              </span>
            ))}
            {(!selNode.enterprises || selNode.enterprises.length === 0) && (
              <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>暂无关联企业，点击"＋ 关联企业"从企业库中添加</span>
            )}
          </div>

          {/* Edges from this node */}
          {edges.filter(e => e.source_node_id === selNode.id || e.target_node_id === selNode.id).length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <h4 className="text-[13px] font-semibold mb-2">连线关系</h4>
              {edges.filter(e => e.source_node_id === selNode.id || e.target_node_id === selNode.id).map(e => {
                const src = nodes.find(n => n.id === e.source_node_id);
                const tgt = nodes.find(n => n.id === e.target_node_id);
                return (
                  <div key={e.id} className="flex items-center gap-2 text-[12px] py-1" style={{ color: 'var(--color-ink-secondary)' }}>
                    {src?.name || '?'} → {tgt?.name || '?'}
                    <button className="text-red-400 hover:text-red-600" onClick={() => handleDeleteEdge(e.id)}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ Modals ═══ */}

      {/* Add/Edit Chain */}
      <ChainFormModal open={showAddChain} title="新建产业链" form={chainForm}
        setName={(v) => setChainForm(p => ({ ...p, name: v }))}
        setDesc={(v) => setChainForm(p => ({ ...p, description: v }))}
        onClose={() => setShowAddChain(false)} onConfirm={handleCreateChain} />
      <ChainFormModal open={showEditChain} title="编辑产业链" form={chainForm}
        setName={(v) => setChainForm(p => ({ ...p, name: v }))}
        setDesc={(v) => setChainForm(p => ({ ...p, description: v }))}
        onClose={() => setShowEditChain(false)} onConfirm={handleUpdateChain} />

      {/* Add Node */}
      <Modal open={showAddNode} onClose={() => setShowAddNode(false)} title="新增产业链节点">
        <NodeForm form={nodeForm}
          setName={(v) => setNodeForm(p => ({ ...p, name: v }))}
          setLayer={(v) => setNodeForm(p => ({ ...p, layer: v }))}
          setDesc={(v) => setNodeForm(p => ({ ...p, description: v }))} />
        <div className="flex justify-end gap-2 pt-3">
          <button className="btn btn-secondary" onClick={() => setShowAddNode(false)}>取消</button>
          <button className="btn btn-primary" onClick={handleAddNode}>确认新增</button>
        </div>
      </Modal>

      {/* Edit Node */}
      <Modal open={showEditNode} onClose={() => setShowEditNode(false)} title="编辑节点">
        <NodeForm form={nodeForm}
          setName={(v) => setNodeForm(p => ({ ...p, name: v }))}
          setLayer={(v) => setNodeForm(p => ({ ...p, layer: v }))}
          setDesc={(v) => setNodeForm(p => ({ ...p, description: v }))} />
        <div className="flex justify-end gap-2 pt-3">
          <button className="btn btn-secondary" onClick={() => setShowEditNode(false)}>取消</button>
          <button className="btn btn-primary" onClick={handleUpdateNode}>保存</button>
        </div>
      </Modal>

      {/* Add Edge */}
      <Modal open={showAddEdge} onClose={() => setShowAddEdge(false)} title="新增连线">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>源节点</label>
              <select className="input mt-0.5" value={edgeForm.source} onChange={e => setEdgeForm(p => ({ ...p, source: e.target.value }))}>
                <option value="">-- 选择 --</option>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>目标节点</label>
              <select className="input mt-0.5" value={edgeForm.target} onChange={e => setEdgeForm(p => ({ ...p, target: e.target.value }))}>
                <option value="">-- 选择 --</option>
                {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setShowAddEdge(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleAddEdge}>确认连线</button>
          </div>
        </div>
      </Modal>

      {/* Link Enterprise */}
      <Modal open={showLinkEnt} onClose={() => { setShowLinkEnt(false); setEntSearch(''); }} title={`关联企业到「${selNode?.name || ''}」`}>
        <div className="space-y-3">
          <input className="input" placeholder="搜索企业名称或行业..." value={entSearch}
            onChange={e => setEntSearch(e.target.value)} />
          <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
            {filteredAvail.length === 0 && (
              <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>没有可关联的企业</span>
            )}
            {filteredAvail.slice(0, 30).map(e => (
              <button key={e.id} className="tag tag-gray cursor-pointer hover:bg-blue-50 text-[12px]"
                onClick={() => handleLinkEnt(e.id)}>
                {e.name}
                <span className="text-[10px] opacity-60 ml-1">({e.industry})</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => { setShowLinkEnt(false); setEntSearch(''); }}>关闭</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Reusable sub-components ──

function ChainFormModal({ open, title, form, setName, setDesc, onClose, onConfirm }: {
  open: boolean; title: string; form: { name: string; description: string };
  setName: (v: string) => void; setDesc: (v: string) => void;
  onClose: () => void; onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <div>
          <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>产业链名称 *</label>
          <input className="input mt-0.5" value={form.name} onChange={e => setName(e.target.value)} placeholder="例如：新能源汽车产业链" />
        </div>
        <div>
          <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>描述</label>
          <input className="input mt-0.5" value={form.description} onChange={e => setDesc(e.target.value)} placeholder="产业链概述" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onConfirm}>确认</button>
        </div>
      </div>
    </Modal>
  );
}

function NodeForm({ form, setName, setLayer, setDesc }: {
  form: { name: string; layer: string; description: string };
  setName: (v: string) => void; setLayer: (v: string) => void; setDesc: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>节点名称 *</label>
        <input className="input mt-0.5" value={form.name} onChange={e => setName(e.target.value)} placeholder="例如：中游-动力电池" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>层级</label>
          <select className="input mt-0.5" value={form.layer} onChange={e => setLayer(e.target.value)}>
            <option>上游</option><option>中游</option><option>下游</option>
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold" style={{ color: 'var(--color-ink-secondary)' }}>描述</label>
          <input className="input mt-0.5" value={form.description} onChange={e => setDesc(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
