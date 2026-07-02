import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useEnterprises } from '../hooks/useEnterprises';
import { enterpriseApi } from '../api/enterprises';
import Modal from '../components/Modal';

const STATUS_OPTIONS = ['全部', '线索', '洽谈中', '已签约', '已落地'];
const STATUS_MAP: Record<string, string> = {
  '线索': 'tag-orange', '洽谈中': 'tag-blue', '已签约': 'tag-green', '已落地': 'tag-green',
};

const EMPTY_FORM = { name: '', industry: '', segment: '', region: '', scale: '', status: '线索', contact: '', demand: '', invest_rating: '', tags: '' };

export default function EnterpriseList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useEnterprises({
    search: search || undefined,
    status: status || undefined,
  });

  const handleCreate = async () => {
    if (!form.name || !form.industry) return;
    setSaving(true);
    try {
      await enterpriseApi.create({
        ...form,
        tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      });
      qc.invalidateQueries({ queryKey: ['enterprises'] });
      setModalOpen(false);
      setForm({ ...EMPTY_FORM });
    } catch (e) { alert('创建失败: ' + (e as Error).message); }
    finally { setSaving(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold mb-1">企业库</h1>
          <p className="text-[14px] text-muted">{data ? `共 ${data.total} 家企业` : '加载中...'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ 新增企业</button>
      </div>

      <div className="flex gap-3 mb-4">
        <input className="flex-1 px-4 py-2.5 border border-border rounded-md text-[14px] focus:outline-none focus:border-accent bg-white"
          placeholder="搜索企业名称、行业、细分领域..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => setStatus(s === '全部' ? '' : s)}
              className={`px-3 py-2 text-[12px] rounded-md border transition-all ${(s === '全部' && !status) || s === status ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-border hover:border-accent'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <div className="card p-12 text-center text-muted">⏳ 加载企业数据...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error.message}</div>}

      {data && (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-[#fafaf8]">
                <th className="text-left px-4 py-3 font-medium text-muted">企业名称</th>
                <th className="text-left px-4 py-3 font-medium text-muted">行业</th>
                <th className="text-left px-4 py-3 font-medium text-muted">细分领域</th>
                <th className="text-left px-4 py-3 font-medium text-muted">地区</th>
                <th className="text-left px-4 py-3 font-medium text-muted">阶段</th>
                <th className="text-left px-4 py-3 font-medium text-muted">评级</th>
                <th className="text-left px-4 py-3 font-medium text-muted">操作</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted">暂无匹配企业</td></tr>
              )}
              {data.items.map((e) => (
                <tr key={e.id} className="border-b border-border hover:bg-[#fafaf8] cursor-pointer" onClick={() => navigate(`/enterprises/${e.id}`)}>
                  <td className="px-4 py-3 font-medium">
                    <div>{e.name}</div>
                    <div className="flex gap-1 mt-0.5">{e.tags?.map((t) => <span key={t} className="tag tag-blue text-[10px]">{t}</span>)}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{e.industry}</td>
                  <td className="px-4 py-3">{e.segment || '-'}</td>
                  <td className="px-4 py-3 text-muted">{e.region || '-'}</td>
                  <td className="px-4 py-3"><span className={`tag ${STATUS_MAP[e.status] || 'tag-gray'}`}>{e.status}</span></td>
                  <td className="px-4 py-3 font-semibold">{e.invest_rating || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to={`/enterprises/${e.id}`} className="text-accent text-[12px] font-medium hover:underline" onClick={(ev) => ev.stopPropagation()}>画像</Link>
                      <Link to={`/workflow/${e.id}`} className="text-accent text-[12px] font-medium hover:underline" onClick={(ev) => ev.stopPropagation()}>工作流 →</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增企业">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted">企业名称 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.name} onChange={set('name')} /></div>
            <div><label className="text-[12px] text-muted">所属行业 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.industry} onChange={set('industry')} /></div>
            <div><label className="text-[12px] text-muted">细分领域</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.segment} onChange={set('segment')} /></div>
            <div><label className="text-[12px] text-muted">所在地区</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.region} onChange={set('region')} /></div>
            <div><label className="text-[12px] text-muted">企业规模</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.scale} onChange={set('scale')}><option value="">--</option><option>大型</option><option>中型</option><option>小型</option></select></div>
            <div><label className="text-[12px] text-muted">招商阶段</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.status} onChange={set('status')}><option>线索</option><option>洽谈中</option><option>已签约</option><option>已落地</option></select></div>
            <div><label className="text-[12px] text-muted">联系人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.contact} onChange={set('contact')} /></div>
            <div><label className="text-[12px] text-muted">投资评级</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.invest_rating} onChange={set('invest_rating')}><option value="">--</option><option>A</option><option>A-</option><option>B+</option><option>B</option><option>C</option></select></div>
          </div>
          <div><label className="text-[12px] text-muted">核心需求</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.demand} onChange={set('demand')} /></div>
          <div><label className="text-[12px] text-muted">标签（逗号分隔）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.tags} onChange={set('tags')} placeholder="如：上市企业, 专精特新, 链主" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? '保存中...' : '确认新增'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
