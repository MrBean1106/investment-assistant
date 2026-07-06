import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { api } from '../api/client';
import { chainApi } from '../api/resources';
import Modal from '../components/Modal';

const LAYER_COLORS: Record<string, string> = { '上游': '#f59e0b', '中游': '#3b82f6', '下游': '#10b981' };

interface ChainNode { id: number; name: string; layer: string; description: string | null; enterprises: string[]; }
interface ChainEdge { id: number; source_node_id: number; target_node_id: number; }
interface AvailEnt { id: number; name: string; industry: string; segment: string; }

export default function IndustryChain() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['chain'], queryFn: () => chainApi.get() });
  const { data: availEnts } = useQuery({ queryKey: ['availEnts'], queryFn: () => api.get<AvailEnt[]>('/industry-chain/available-enterprises') });

  const [selNode, setSelNode] = useState<ChainNode | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [showAddEnt, setShowAddEnt] = useState(false);
  const [nodeForm, setNodeForm] = useState({ name: '', layer: '中游', description: '', enterprises: '' });
  const [edgeForm, setEdgeForm] = useState({ source: '', target: '' });
  const [entForm, setEntForm] = useState('');

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  const handleAddNode = async () => {
    if (!nodeForm.name) return;
    await api.post('/industry-chain/nodes', { ...nodeForm, enterprises: nodeForm.enterprises ? nodeForm.enterprises.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [] });
    qc.invalidateQueries({ queryKey: ['chain'] });
    setShowAddNode(false); setNodeForm({ name: '', layer: '中游', description: '', enterprises: '' });
  };

  const handleDeleteNode = async (id: number) => {
    if (!confirm('确定删除该节点及关联连线？')) return;
    await api.del(`/industry-chain/nodes/${id}`);
    qc.invalidateQueries({ queryKey: ['chain'] });
    setSelNode(null);
  };

  const handleAddEdge = async () => {
    if (!edgeForm.source || !edgeForm.target) return;
    await api.post('/industry-chain/edges', { source_node_id: Number(edgeForm.source), target_node_id: Number(edgeForm.target) });
    qc.invalidateQueries({ queryKey: ['chain'] });
    setShowAddEdge(false); setEdgeForm({ source: '', target: '' });
  };

  const handleDeleteEdge = async (id: number) => {
    await api.del(`/industry-chain/edges/${id}`);
    qc.invalidateQueries({ queryKey: ['chain'] });
  };

  const handleAddEntToNode = async () => {
    if (!selNode || !entForm) return;
    await api.post(`/industry-chain/nodes/${selNode.id}/enterprises`, { name: entForm });
    qc.invalidateQueries({ queryKey: ['chain'] });
    setEntForm('');
    setShowAddEnt(false);
  };

  const handleRemoveEnt = async (name: string) => {
    if (!selNode) return;
    await api.del(`/industry-chain/nodes/${selNode.id}/enterprises/${encodeURIComponent(name)}`);
    qc.invalidateQueries({ queryKey: ['chain'] });
  };

  const option = {
    tooltip: { trigger: 'item', formatter: (p: { data: { name: string; layer: string; desc: string; enterprises: string[] } }) => {
      const d = p.data; return `<b>${d.name}</b><br/>${d.layer}<br/>${d.desc||''}<br/>企业：${(d.enterprises||[]).join('、')||'无'}`;
    }},
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      force: { repulsion: 400, edgeLength: [150, 350], gravity: 0.08 },
      label: { show: true, fontSize: 11, color: '#333', position: 'right' },
      edgeSymbol: ['none', 'arrow'], edgeSymbolSize: 8,
      lineStyle: { color: '#c0c0c0', curveness: 0.1 },
      data: nodes.map(n => ({ name: n.name, symbolSize: 40 + (n.enterprises?.length||0)*5, itemStyle: { color: LAYER_COLORS[n.layer]||'#999' }, desc: n.description, enterprises: n.enterprises, layer: n.layer })),
      links: edges.map(e => ({ source: nodes.find(n=>n.id===e.source_node_id)?.name||'', target: nodes.find(n=>n.id===e.target_node_id)?.name||'' })),
      categories: Object.entries(LAYER_COLORS).map(([n,c]) => ({ name: n, itemStyle: { color: c } })),
    }],
  };

  const onEvents = { click: (p: { data?: { name: string } }) => {
    if (p.data?.name) setSelNode(nodes.find(n=>n.name===p.data.name)||null);
  }};

  if (isLoading) return <div className="p-8 text-center" style={{color:'var(--color-muted)'}}>⏳</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="page-title">产业图谱</h1>
          <p className="page-subtitle">{nodes.length} 节点 · {edges.length} 连线</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-[12px]" onClick={() => setShowAddNode(true)}>＋ 新增节点</button>
          <button className="btn btn-secondary text-[12px]" onClick={() => setShowAddEdge(true)}>＋ 新增连线</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        {Object.entries(LAYER_COLORS).map(([l,c]) => (
          <div key={l} className="flex items-center gap-1.5 text-[12px]" style={{color:'var(--color-muted)'}}>
            <span className="w-3 h-3 rounded-full inline-block" style={{backgroundColor:c}}/>{l}
          </div>))}
        <span className="text-[12px]" style={{color:'var(--color-muted)'}}>拖拽缩放</span>
      </div>

      <div className="card p-2 mb-4" style={{height:480}}>
        <ReactECharts option={option} style={{height:'100%',width:'100%'}} onEvents={onEvents} opts={{renderer:'canvas'}}/>
      </div>

      {/* Selected Node Detail */}
      {selNode && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="font-bold text-[15px]">{selNode.name}</span>
              <span className="tag ml-2" style={{backgroundColor:(LAYER_COLORS[selNode.layer]||'#999')+'20',color:LAYER_COLORS[selNode.layer]}}>{selNode.layer}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost text-[12px]" onClick={() => setShowAddEnt(true)}>＋ 添加企业</button>
              <button className="btn btn-ghost text-[12px]" style={{color:'var(--color-danger)'}} onClick={() => handleDeleteNode(selNode.id)}>🗑 删除节点</button>
              <button className="text-lg leading-none" style={{color:'var(--color-muted)'}} onClick={()=>setSelNode(null)}>×</button>
            </div>
          </div>
          <p className="text-[13px] mb-3" style={{color:'var(--color-ink-secondary)'}}>{selNode.description}</p>

          <h4 className="text-[13px] font-semibold mb-2">关联企业（{selNode.enterprises?.length||0}家）</h4>
          <div className="flex flex-wrap gap-2">
            {selNode.enterprises?.map(e => (
              <span key={e} className="tag tag-blue flex items-center gap-1" style={{cursor:'pointer'}}>
                {e}
                <button className="text-[10px] hover:text-red-500" onClick={()=>handleRemoveEnt(e)}>×</button>
              </span>))}
            {(!selNode.enterprises||selNode.enterprises.length===0) && <span className="text-[12px]" style={{color:'var(--color-muted)'}}>暂无关联企业</span>}
          </div>

          {/* Edges from this node */}
          {edges.filter(e=>e.source_node_id===selNode.id||e.target_node_id===selNode.id).length > 0 && (
            <div className="mt-4 pt-3 border-t" style={{borderColor:'var(--color-border)'}}>
              <h4 className="text-[13px] font-semibold mb-2">连线关系</h4>
              {edges.filter(e=>e.source_node_id===selNode.id||e.target_node_id===selNode.id).map(e => {
                const src = nodes.find(n=>n.id===e.source_node_id);
                const tgt = nodes.find(n=>n.id===e.target_node_id);
                return (
                  <div key={e.id} className="flex items-center gap-2 text-[12px] py-1" style={{color:'var(--color-ink-secondary)'}}>
                    {src?.name||'?'} → {tgt?.name||'?'}
                    <button className="text-red-400 hover:text-red-600" onClick={()=>handleDeleteEdge(e.id)}>×</button>
                  </div>);
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Add Node */}
      <Modal open={showAddNode} onClose={()=>setShowAddNode(false)} title="新增产业链节点">
        <div className="space-y-3">
          <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>节点名称 *</label><input className="input mt-0.5" value={nodeForm.name} onChange={e=>setNodeForm({...nodeForm,name:e.target.value})}/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>层级</label><select className="input mt-0.5" value={nodeForm.layer} onChange={e=>setNodeForm({...nodeForm,layer:e.target.value})}><option>上游</option><option>中游</option><option>下游</option></select></div>
            <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>描述</label><input className="input mt-0.5" value={nodeForm.description} onChange={e=>setNodeForm({...nodeForm,description:e.target.value})}/></div>
          </div>
          <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>企业（逗号分隔）</label><input className="input mt-0.5" value={nodeForm.enterprises} onChange={e=>setNodeForm({...nodeForm,enterprises:e.target.value})} placeholder="宁德时代, 比亚迪"/></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={()=>setShowAddNode(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleAddNode}>确认新增</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Edge */}
      <Modal open={showAddEdge} onClose={()=>setShowAddEdge(false)} title="新增连线">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>源节点 ID</label><select className="input mt-0.5" value={edgeForm.source} onChange={e=>setEdgeForm({...edgeForm,source:e.target.value})}><option value="">--</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
            <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>目标节点 ID</label><select className="input mt-0.5" value={edgeForm.target} onChange={e=>setEdgeForm({...edgeForm,target:e.target.value})}><option value="">--</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.name}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={()=>setShowAddEdge(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleAddEdge}>确认连线</button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Enterprise to Node */}
      <Modal open={showAddEnt} onClose={()=>setShowAddEnt(false)} title={`添加企业到「${selNode?.name||''}」`}>
        <div className="space-y-3">
          <div><label className="text-[12px] font-semibold" style={{color:'var(--color-ink-secondary)'}}>输入企业名称 或 从企业库选择</label>
            <input className="input mt-1" value={entForm} onChange={e=>setEntForm(e.target.value)} placeholder="输入企业名称或选择..." list="ent-list"/>
            <datalist id="ent-list">{(availEnts||[]).map(e=><option key={e.id} value={e.name}/>)}</datalist>
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {(availEnts||[]).slice(0,20).map(e=>
              <button key={e.id} className="tag tag-gray cursor-pointer" onClick={()=>setEntForm(e.name)}>{e.name}</button>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={()=>setShowAddEnt(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleAddEntToNode}>确认添加</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
