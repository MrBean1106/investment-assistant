import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProperties } from '../hooks/useResources';
import { propertyApi } from '../api/resources';
import Modal from '../components/Modal';

const TYPE_MAP: Record<string, string> = { '研发办公': 'tag-blue', '生产厂房': 'tag-orange', '商务办公': 'tag-purple', '研发中试': 'tag-green' };
const EMPTY = { name: '', type: '研发办公', area: '', floor: '', price: '', location: '', features: '', tags: '' };

export default function PropertyList() {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading, error } = useProperties(search || undefined);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await propertyApi.create({ ...form, tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [] });
      qc.invalidateQueries({ queryKey: ['properties'] });
      setModalOpen(false); setForm({ ...EMPTY });
    } catch (e) { alert('创建失败: ' + (e as Error).message); }
    finally { setSaving(false); }
  };
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-xl font-bold mb-1">物业资源库</h1><p className="text-[14px] text-muted">{data ? `${data.length} 处物业` : '加载中...'}</p></div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ 新增物业</button>
      </div>
      <input className="w-full px-4 py-2.5 border border-border rounded-md text-[14px] mb-4 focus:outline-none focus:border-accent bg-white"
        placeholder="搜索物业名称、位置..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading && <div className="card p-12 text-center text-muted">⏳ 加载中...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error.message}</div>}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.length === 0 && <div className="md:col-span-2 card p-8 text-center text-muted">暂无匹配物业</div>}
          {data.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="font-semibold text-[14px]">{p.name}</div>
                {p.type && <span className={`tag ${TYPE_MAP[p.type] || 'tag-gray'}`}>{p.type}</span>}
              </div>
              <div className="text-[13px] text-muted space-y-1">
                {p.area && <div>📐 面积：{p.area}{p.floor ? ` | ${p.floor}` : ''}</div>}
                {p.price && <div>💰 单价：{p.price}</div>}
                {p.location && <div>📍 位置：{p.location}</div>}
                {p.features && <div className="text-ink mt-1">📌 {p.features}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="新增物业">
        <div className="space-y-3">
          <div><label className="text-[12px] text-muted">物业名称 *</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.name} onChange={set('name')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted">物业类型</label><select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white" value={form.type} onChange={set('type')}><option>研发办公</option><option>生产厂房</option><option>商务办公</option><option>研发中试</option></select></div>
            <div><label className="text-[12px] text-muted">位置</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.location} onChange={set('location')} /></div>
            <div><label className="text-[12px] text-muted">面积</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.area} onChange={set('area')} placeholder="如：5000㎡" /></div>
            <div><label className="text-[12px] text-muted">楼层</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.floor} onChange={set('floor')} placeholder="如：3-5层" /></div>
            <div><label className="text-[12px] text-muted">单价</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.price} onChange={set('price')} placeholder="如：35元/㎡/月" /></div>
            <div><label className="text-[12px] text-muted">标签（逗号分隔）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.tags} onChange={set('tags')} placeholder="如：研发, 办公" /></div>
          </div>
          <div><label className="text-[12px] text-muted">特色描述</label><textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={2} value={form.features} onChange={set('features')} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? '保存中...' : '确认新增'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
