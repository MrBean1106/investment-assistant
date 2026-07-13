import { useEffect, useState } from 'react';
import { leadsApi } from '../api/leads';
import type { Lead, LeadStats } from '../types';

const STAGES = ['初步接触', '意向洽谈', '深度对接', '签约落地', '已落地', '已流失'];
const SOURCES = ['展会', '招商推介', '以商招商', '主动挖掘', '网络', '其他'];
const PRIORITIES = ['高', '中', '低'];

const STAGE_TAG: Record<string, string> = {
  初步接触: 'tag-gray',
  意向洽谈: 'tag-blue',
  深度对接: 'tag-purple',
  签约落地: 'tag-orange',
  已落地: 'tag-green',
  已流失: 'tag-gray',
};
const PRIORITY_TAG: Record<string, string> = {
  高: 'tag-orange',
  中: 'tag-blue',
  低: 'tag-gray',
};

interface LeadForm {
  company_name: string;
  title: string;
  source: string;
  stage: string;
  priority: string;
  owner: string;
  contact_name: string;
  contact_info: string;
  intent_investment: string;
  intent_region: string;
  expected_landing_date: string;
  progress: number;
  next_action: string;
  notes: string;
}

function emptyForm(): LeadForm {
  return {
    company_name: '', title: '', source: '', stage: '初步接触', priority: '中',
    owner: '', contact_name: '', contact_info: '', intent_investment: '',
    intent_region: '', expected_landing_date: '', progress: 0, next_action: '', notes: '',
  };
}

function fromLead(lead: Lead): LeadForm {
  return {
    company_name: lead.company_name,
    title: lead.title || '',
    source: lead.source || '',
    stage: lead.stage,
    priority: lead.priority,
    owner: lead.owner || '',
    contact_name: lead.contact_name || '',
    contact_info: lead.contact_info || '',
    intent_investment: lead.intent_investment || '',
    intent_region: lead.intent_region || '',
    expected_landing_date: lead.expected_landing_date || '',
    progress: lead.progress || 0,
    next_action: lead.next_action || '',
    notes: lead.notes || '',
  };
}

function toPayload(form: LeadForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_name: form.company_name,
    stage: form.stage,
    priority: form.priority,
    progress: Number(form.progress) || 0,
  };
  const opt = ['title', 'source', 'owner', 'contact_name', 'contact_info', 'intent_investment', 'intent_region', 'next_action', 'notes'];
  for (const k of opt) {
    const v = (form as unknown as Record<string, string>)[k];
    if (v) payload[k] = v;
  }
  if (form.expected_landing_date) payload.expected_landing_date = form.expected_landing_date;
  return payload;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN');
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(emptyForm());
  const [detail, setDetail] = useState<Lead | null>(null);
  const [fuContent, setFuContent] = useState('');
  const [fuOwner, setFuOwner] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, st] = await Promise.all([
        leadsApi.list({ search: search || undefined, stage: stageFilter || undefined }),
        leadsApi.stats(),
      ]);
      setLeads(list.items);
      setStats(st);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, stageFilter]);

  const setField = (k: keyof LeadForm, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };
  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm(fromLead(lead));
    setShowForm(true);
  };
  const submit = async () => {
    if (!form.company_name.trim()) {
      alert('请填写企业名称');
      return;
    }
    setSaving(true);
    try {
      if (editing) await leadsApi.update(editing.id, toPayload(form));
      else await leadsApi.create(toPayload(form));
      setShowForm(false);
      setMsg(editing ? '✅ 已更新线索' : '✅ 已创建线索');
      await load();
    } catch (e) {
      alert('保存失败：' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const advance = async (lead: Lead) => {
    const idx = STAGES.indexOf(lead.stage);
    if (idx < 0 || idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1];
    const progress = Math.min(100, (lead.progress || 0) + 20);
    try {
      await leadsApi.update(lead.id, { stage: next, progress });
      setMsg(`✅ 已推进至「${next}」`);
      await load();
    } catch (e) {
      alert('推进失败：' + (e as Error).message);
    }
  };

  const handleDelete = async (lead: Lead) => {
    if (!confirm(`确定删除线索「${lead.company_name}」吗？此操作不可恢复。`)) return;
    try {
      await leadsApi.delete(lead.id);
      setMsg('🗑️ 已删除线索');
      await load();
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    }
  };

  const openDetail = async (lead: Lead) => {
    try {
      const d = await leadsApi.get(lead.id);
      setDetail(d);
      setFuContent('');
      setFuOwner('');
    } catch (e) {
      alert('加载失败：' + (e as Error).message);
    }
  };

  const addFu = async () => {
    if (!detail || !fuContent.trim()) return;
    try {
      const updated = await leadsApi.addFollowUp(detail.id, {
        content: fuContent,
        owner: fuOwner || undefined,
      });
      setDetail(updated);
      setFuContent('');
      setMsg('✅ 已记录对接');
      await load();
    } catch (e) {
      alert('记录失败：' + (e as Error).message);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold mb-1">招商线索</h1>
          <p className="text-[14px] text-muted">
            {stats ? `${stats.active} 条活跃线索 / 共 ${stats.total} 条` : '加载中...'}
            <span className="ml-2 text-[12px]">从初步接触到签约落地的全流程跟进</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ 新增线索</button>
      </div>

      {msg && (
        <div className="card p-3 mb-4 text-[13px] text-ink">{msg}</div>
      )}

      {/* 阶段看板 */}
      {stats && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
          {STAGES.map((s) => (
            <div key={s} className="stat-card !p-3">
              <div className="stat-label !text-[12px]">{s}</div>
              <div className="stat-value !text-[22px]">{stats.by_stage[s] ?? 0}</div>
            </div>
          ))}
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="input max-w-[260px]"
          placeholder="搜索企业 / 项目 / 负责人"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[160px]" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">全部阶段</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {stageFilter && (
          <button className="btn btn-ghost" onClick={() => setStageFilter('')}>清除筛选</button>
        )}
      </div>

      {loading && <div className="card p-12 text-center text-muted">⏳ 加载中...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error}</div>}

      {!loading && !error && (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>企业 / 项目</th>
                <th>阶段</th>
                <th>优先级</th>
                <th>负责人</th>
                <th>意向投资</th>
                <th>进度</th>
                <th>下一步</th>
                <th>更新</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-10">
                    暂无线索，点击右上角「新增线索」开始记录招商跟进
                  </td>
                </tr>
              )}
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="font-medium text-ink">{lead.company_name}</div>
                    {lead.title && <div className="text-[12px] text-muted">{lead.title}</div>}
                  </td>
                  <td><span className={`tag ${STAGE_TAG[lead.stage] || 'tag-gray'}`}>{lead.stage}</span></td>
                  <td><span className={`tag ${PRIORITY_TAG[lead.priority] || 'tag-gray'}`}>{lead.priority}</span></td>
                  <td className="text-ink-secondary">{lead.owner || '-'}</td>
                  <td className="text-ink-secondary">{lead.intent_investment || '-'}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar w-20">
                        <div className="progress-fill" style={{ width: `${lead.progress}%` }}></div>
                      </div>
                      <span className="text-[12px] text-muted">{lead.progress}%</span>
                    </div>
                  </td>
                  <td className="text-ink-secondary max-w-[200px] truncate" title={lead.next_action || ''}>
                    {lead.next_action || '-'}
                  </td>
                  <td className="text-[12px] text-muted">{formatDate(lead.updated_at)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {(() => {
                        const idx = STAGES.indexOf(lead.stage);
                        const canAdvance = idx >= 0 && idx < STAGES.length - 1;
                        return canAdvance ? (
                          <button className="text-[15px] px-1.5 py-0.5 rounded hover:bg-green-50 text-success" onClick={() => advance(lead)} title={`推进至「${STAGES[idx + 1]}」`}>→</button>
                        ) : (
                          <span className="text-[12px] px-1.5 text-muted" title="已结束阶段">✓</span>
                        );
                      })()}
                      <button className="text-[12px] px-1.5 py-0.5 rounded hover:bg-gray-100 text-accent" onClick={() => openDetail(lead)} title="详情/对接记录">👁</button>
                      <button className="text-[12px] px-1.5 py-0.5 rounded hover:bg-gray-100 text-muted" onClick={() => openEdit(lead)} title="编辑">✎</button>
                      <button className="text-[12px] px-1.5 py-0.5 rounded hover:bg-red-50 text-muted hover:text-red-500" onClick={() => handleDelete(lead)} title="删除">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-semibold text-[15px]">{editing ? '编辑线索' : '新增线索'}</div>
              <button className="text-muted text-[13px] px-1.5 py-0.5 rounded hover:bg-gray-100" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="p-5 overflow-y-auto grid grid-cols-2 gap-4">
              <Field label="企业名称 *">
                <input className="input" value={form.company_name} onChange={(e) => setField('company_name', e.target.value)} placeholder="如：宁德时代新能源科技" />
              </Field>
              <Field label="线索标题">
                <input className="input" value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="如：二期扩产项目" />
              </Field>
              <Field label="线索来源">
                <select className="input" value={form.source} onChange={(e) => setField('source', e.target.value)}>
                  <option value="">未填写</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="阶段">
                <select className="input" value={form.stage} onChange={(e) => setField('stage', e.target.value)}>
                  {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="优先级">
                <select className="input" value={form.priority} onChange={(e) => setField('priority', e.target.value)}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="负责人">
                <input className="input" value={form.owner} onChange={(e) => setField('owner', e.target.value)} />
              </Field>
              <Field label="联系人">
                <input className="input" value={form.contact_name} onChange={(e) => setField('contact_name', e.target.value)} />
              </Field>
              <Field label="联系方式">
                <input className="input" value={form.contact_info} onChange={(e) => setField('contact_info', e.target.value)} />
              </Field>
              <Field label="意向投资金额">
                <input className="input" value={form.intent_investment} onChange={(e) => setField('intent_investment', e.target.value)} placeholder="如：50亿" />
              </Field>
              <Field label="意向落地地区">
                <input className="input" value={form.intent_region} onChange={(e) => setField('intent_region', e.target.value)} />
              </Field>
              <Field label="预计落地时间">
                <input className="input" type="date" value={form.expected_landing_date} onChange={(e) => setField('expected_landing_date', e.target.value)} />
              </Field>
              <Field label={`进度（${form.progress}%）`}>
                <input className="input" type="range" min={0} max={100} step={5} value={form.progress} onChange={(e) => setField('progress', Number(e.target.value))} />
              </Field>
              <Field label="下一步动作" full>
                <input className="input" value={form.next_action} onChange={(e) => setField('next_action', e.target.value)} placeholder="如：安排实地考察" />
              </Field>
              <Field label="备注" full>
                <textarea className="input" rows={3} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
              </Field>
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? '⏳ 保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 详情 / 对接记录弹窗 */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-semibold text-[15px]">{detail.company_name}</div>
              <button className="text-muted text-[13px] px-1.5 py-0.5 rounded hover:bg-gray-100" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className={`tag ${STAGE_TAG[detail.stage] || 'tag-gray'}`}>{detail.stage}</span>
                <span className={`tag ${PRIORITY_TAG[detail.priority] || 'tag-gray'}`}>优先级 {detail.priority}</span>
                {detail.source && <span className="tag tag-gray">{detail.source}</span>}
                {detail.intent_investment && <span className="tag tag-blue">意向 {detail.intent_investment}</span>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px] mb-4">
                <Info label="负责人" value={detail.owner} />
                <Info label="意向地区" value={detail.intent_region} />
                <Info label="联系人" value={detail.contact_name} />
                <Info label="联系方式" value={detail.contact_info} />
                <Info label="预计落地" value={detail.expected_landing_date} />
                <Info label="进度" value={`${detail.progress}%`} />
                <Info label="下一步" value={detail.next_action} full />
                <Info label="备注" value={detail.notes} full />
              </div>

              <div className="divider"></div>
              <div className="font-semibold text-[14px] mb-2">对接记录（{detail.follow_ups.length}）</div>
              <div className="space-y-2 mb-4">
                {detail.follow_ups.length === 0 && (
                  <div className="text-[13px] text-muted">暂无对接记录，在下方添加。</div>
                )}
                {detail.follow_ups.map((fu, i) => (
                  <div key={i} className="bg-gray-50 rounded-md p-2.5 text-[13px]">
                    <div className="flex justify-between text-muted text-[12px] mb-0.5">
                      <span>{fu.owner}</span>
                      <span>{formatDate(fu.date)}</span>
                    </div>
                    <div className="text-ink">{fu.content}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="记录本次对接内容…" value={fuContent} onChange={(e) => setFuContent(e.target.value)} />
                <input className="input max-w-[120px]" placeholder="记录人" value={fuOwner} onChange={(e) => setFuOwner(e.target.value)} />
                <button className="btn btn-primary" onClick={addFu} disabled={!fuContent.trim()}>添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-[12px] font-medium text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string | null | undefined; full?: boolean }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <span className="text-muted">{label}：</span>
      <span className="text-ink">{value || '-'}</span>
    </div>
  );
}
