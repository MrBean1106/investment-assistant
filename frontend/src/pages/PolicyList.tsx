import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePolicies } from '../hooks/useResources';
import { policyApi } from '../api/resources';
import Modal from '../components/Modal';

const LEVEL_MAP: Record<string, string> = { '国家级': 'tag-orange', '省级': 'tag-blue', '市级': 'tag-green', '区级': 'tag-gray' };
const CAT_MAP: Record<string, string> = { '税收优惠': 'tag-blue', '资金奖补': 'tag-green', '土地保障': 'tag-orange', '人才政策': 'tag-purple' };

const EMPTY = { title: '', level: '市级', category: '税收优惠', scope: '', benefit: '', match_tags: '' };

export default function PolicyList() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading, error } = usePolicies(search || undefined);

  const handleCreate = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await policyApi.create({ ...form, match_tags: form.match_tags ? form.match_tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [] });
      qc.invalidateQueries({ queryKey: ['policies'] });
      setModalOpen(false); setForm({ ...EMPTY });
    } catch (e) { alert('创建失败: ' + (e as Error).message); }
    finally { setSaving(false); }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-bold mb-1">政策库</h1><p className="text-[14px] text-muted">{data ? `${data.length} 项政策` : '加载中...'}</p></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ 新增政策</button>
      </div>
      <input className="w-full px-4 py-2.5 border border-border rounded-md text-[14px] mb-4 focus:outline-none focus:border-accent bg-white"
        placeholder="搜索政策标题..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading && <div className="card p-12 text-center text-muted">⏳ 加载中...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error.message}</div>}
      {data && (
        <div className="space-y-3">
          {data.length === 0 && <div className="card p-8 text-center text-muted">暂无匹配政策</div>}
          {data.map((p) => (
            <div key={p.id} className="card p-4 flex items-start gap-4">
              <span className="text-2xl mt-0.5">📜</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-[14px]">{p.title}</span>
                  {p.level && <span className={`tag ${LEVEL_MAP[p.level] || 'tag-gray'}`}>{p.level}</span>}
                  {p.category && <span className={`tag ${CAT_MAP[p.category] || 'tag-gray'}`}>{p.category}</span>}
                </div>
                {p.scope && <p className="text-[13px] text-muted">适用范围：{p.scope}</p>}
                {p.benefit && <p className="text-[13px] text-accent mt-0.5 font-medium">✅ {p.benefit}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增政策">
        <div className="space-y-3">
          <div><label className="text-[12px] text-muted">政策标题 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.title} onChange={set('title')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted">政策级别</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.level} onChange={set('level')}><option>国家级</option><option>省级</option><option>市级</option><option>区级</option></select></div>
            <div><label className="text-[12px] text-muted">类别</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.category} onChange={set('category')}><option>税收优惠</option><option>资金奖补</option><option>土地保障</option><option>人才政策</option></select></div>
          </div>
          <div><label className="text-[12px] text-muted">适用范围</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.scope} onChange={set('scope')} /></div>
          <div><label className="text-[12px] text-muted">优惠内容</label><textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={2} value={form.benefit} onChange={set('benefit')} /></div>
          <div><label className="text-[12px] text-muted">匹配标签（逗号分隔）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.match_tags} onChange={set('match_tags')} placeholder="如：制造业, 高新技术" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? '保存中...' : '确认新增'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
