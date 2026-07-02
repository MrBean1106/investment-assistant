import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEnterprise } from '../hooks/useEnterprises';
import { useQueryClient } from '@tanstack/react-query';
import { enterpriseApi } from '../api/enterprises';
import { useState } from 'react';
import Modal from '../components/Modal';

const STATUS_MAP: Record<string, string> = { '线索': 'tag-orange', '洽谈中': 'tag-blue', '已签约': 'tag-green', '已落地': 'tag-green' };

export default function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: ent, isLoading, error } = useEnterprise(Number(id));
  const [tab, setTab] = useState<'profile' | 'match'>('profile');

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    if (!ent) return;
    setForm({
      name: ent.name, industry: ent.industry, segment: ent.segment || '', region: ent.region || '',
      scale: ent.scale || '', status: ent.status, contact: ent.contact || '', demand: ent.demand || '',
      invest_rating: ent.invest_rating || '', tags: ent.tags?.join(', ') || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!ent || !form.name || !form.industry) return;
    setSaving(true);
    try {
      await enterpriseApi.update(ent.id, {
        ...form,
        tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      });
      qc.invalidateQueries({ queryKey: ['enterprise', ent.id] });
      qc.invalidateQueries({ queryKey: ['enterprises'] });
      setEditOpen(false);
    } catch (e) { alert('更新失败: ' + (e as Error).message); }
    finally { setSaving(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (isLoading) return <div className="p-8 text-center text-muted">⏳ 加载中...</div>;
  if (error) return <div className="p-8 text-red-500">加载失败：{error.message}</div>;
  if (!ent) return <div className="p-8 text-muted">企业不存在</div>;

  const painPoints = ent.pain_points || {};

  return (
    <div className="p-8 max-w-4xl">
      <Link to="/enterprises" className="text-[13px] text-accent mb-4 inline-block hover:underline">← 返回企业库</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{ent.name}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            {ent.tags?.map((t) => <span key={t} className="tag tag-blue">{t}</span>)}
            <span className={`tag ${STATUS_MAP[ent.status] || 'tag-gray'}`}>{ent.status}</span>
            {ent.invest_rating && <span className="tag tag-green">评级 {ent.invest_rating}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={openEdit} className="btn btn-secondary">✏️ 编辑</button>
          <button onClick={() => navigate(`/workflow/${ent.id}`)} className="btn btn-primary">🚀 工作流</button>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-[14px] mb-3">基本信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
          <div><span className="text-muted">行业：</span>{ent.industry}</div>
          <div><span className="text-muted">细分：</span>{ent.segment || '-'}</div>
          <div><span className="text-muted">地区：</span>{ent.region || '-'}</div>
          <div><span className="text-muted">规模：</span>{ent.scale || '-'}</div>
          <div><span className="text-muted">联系人：</span>{ent.contact || '-'}</div>
          <div><span className="text-muted">状态：</span>{ent.status}</div>
        </div>
        {ent.demand && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">核心需求：</span><span className="text-[13px]">{ent.demand}</span></div>}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('profile')} className={`btn text-[13px] ${tab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}>📋 企业画像</button>
        <button onClick={() => setTab('match')} className={`btn text-[13px] ${tab === 'match' ? 'btn-primary' : 'btn-secondary'}`}>🔍 资源匹配</button>
      </div>

      {tab === 'profile' && (
        <div className="card p-5">
          <h3 className="font-semibold text-[14px] mb-3">痛点与需求分析</h3>
          {Object.keys(painPoints).length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>暂无痛点分析数据</p>
              <Link to={`/workflow/${ent.id}`} className="text-accent text-[13px] mt-2 inline-block hover:underline">进入工作流生成画像 →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(painPoints).map(([cat, items]) => (
                <div key={cat} className="border border-border rounded-md p-3">
                  <span className="text-[13px] font-semibold">{cat}</span>
                  <ul className="text-[13px] text-muted list-disc list-inside mt-1">
                    {Array.isArray(items) && items.map((it, i) => <li key={i}>{it}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'match' && (
        <div className="card p-5 text-center py-8 text-muted">
          <p className="text-2xl mb-2">🔍</p><p>匹配引擎在工作流中启动</p>
          <Link to={`/workflow/${ent.id}`} className="btn btn-primary mt-4 inline-flex">🚀 开始匹配</Link>
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`编辑 — ${ent.name}`}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted">企业名称 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.name || ''} onChange={set('name')} /></div>
            <div><label className="text-[12px] text-muted">所属行业 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.industry || ''} onChange={set('industry')} /></div>
            <div><label className="text-[12px] text-muted">细分领域</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.segment || ''} onChange={set('segment')} /></div>
            <div><label className="text-[12px] text-muted">所在地区</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.region || ''} onChange={set('region')} /></div>
            <div><label className="text-[12px] text-muted">规模</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.scale || ''} onChange={set('scale')}><option value="">--</option><option>大型</option><option>中型</option><option>小型</option></select></div>
            <div><label className="text-[12px] text-muted">阶段</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.status || ''} onChange={set('status')}><option>线索</option><option>洽谈中</option><option>已签约</option><option>已落地</option></select></div>
            <div><label className="text-[12px] text-muted">联系人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.contact || ''} onChange={set('contact')} /></div>
            <div><label className="text-[12px] text-muted">评级</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.invest_rating || ''} onChange={set('invest_rating')}><option value="">--</option><option>A</option><option>A-</option><option>B+</option><option>B</option><option>C</option></select></div>
          </div>
          <div><label className="text-[12px] text-muted">核心需求</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.demand || ''} onChange={set('demand')} /></div>
          <div><label className="text-[12px] text-muted">标签（逗号分隔）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.tags || ''} onChange={set('tags')} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleUpdate} disabled={saving}>{saving ? '保存中...' : '保存修改'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
