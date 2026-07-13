import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEnterprise } from '../hooks/useEnterprises';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { enterpriseApi } from '../api/enterprises';
import { aiApi, type MatchResult } from '../api/ai';
import { attachmentsApi } from '../api/attachments';
import { useState, useCallback, useRef } from 'react';
import Modal from '../components/Modal';

const STATUS_MAP: Record<string, string> = { '线索': 'tag-orange', '洽谈中': 'tag-blue', '已签约': 'tag-green', '已落地': 'tag-green' };

interface InvestmentAnalysis {
  rating?: string;
  highlights?: string[];
  risks?: string[];
  estimated_investment?: string;
  job_creation?: string;
}

export default function EnterpriseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: ent, isLoading, error } = useEnterprise(Number(id));
  const { data: chainMemberships } = useQuery({
    queryKey: ['enterprise-chains', Number(id)],
    queryFn: () => api.get<Array<{ node_id: number; node_name: string; node_layer: string; chain_id: number; chain_name: string }>>(`/industry-chain/enterprise/${id}/chains`),
    enabled: !!id,
  });
  const [tab, setTab] = useState<'profile' | 'match' | 'files'>('profile');

  // Match state
  const [policyMatches, setPolicyMatches] = useState<MatchResult[] | null>(null);
  const [propertyMatches, setPropertyMatches] = useState<MatchResult[] | null>(null);
  const [matchLoading, setMatchLoading] = useState<'policies' | 'properties' | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // AI profile generation state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const runPolicyMatch = useCallback(async () => {
    if (!ent) return;
    setMatchLoading('policies');
    setMatchError(null);
    try {
      const res = await aiApi.matchPolicies(ent.id);
      setPolicyMatches(res.matches?.matches || []);
    } catch (e) {
      setMatchError((e as Error).message);
    } finally {
      setMatchLoading(null);
    }
  }, [ent]);

  const runPropertyMatch = useCallback(async () => {
    if (!ent) return;
    setMatchLoading('properties');
    setMatchError(null);
    try {
      const res = await aiApi.matchProperties(ent.id);
      setPropertyMatches(res.matches?.matches || []);
    } catch (e) {
      setMatchError((e as Error).message);
    } finally {
      setMatchLoading(null);
    }
  }, [ent]);

  const runProfile = useCallback(async () => {
    if (!ent) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      await aiApi.generateProfile(ent.id);
      qc.invalidateQueries({ queryKey: ['enterprise', ent.id] });
      qc.invalidateQueries({ queryKey: ['enterprises'] });
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setProfileLoading(false);
    }
  }, [ent, qc]);

  // Attachment (过程文件) state
  const [fileNote, setFileNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: files, isLoading: filesLoading, refetch: refetchFiles } = useQuery({
    queryKey: ['enterprise-files', Number(id)],
    queryFn: () => attachmentsApi.list(Number(id)),
    enabled: !!id && tab === 'files',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || !ent) return;
    setUploading(true);
    try {
      for (const f of Array.from(list)) {
        await attachmentsApi.upload(ent.id, f, fileNote || undefined);
      }
      setFileNote('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refetchFiles();
    } catch (err) {
      alert('上传失败: ' + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (docId: number) => {
    if (!confirm('确认删除该附件？')) return;
    try {
      await attachmentsApi.remove(docId);
      await refetchFiles();
    } catch (err) {
      alert('删除失败: ' + (err as Error).message);
    }
  };

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
      founder: ent.founder || '', registration: ent.registration || '', leader: ent.leader || '',
      intro: ent.intro || '', main_business: ent.main_business || '', funding_round: ent.funding_round || '',
      pre_valuation: ent.pre_valuation != null ? String(ent.pre_valuation) : '',
      demand_amount: ent.demand_amount != null ? String(ent.demand_amount) : '',
      first_visit: ent.first_visit || '', space_demand: ent.space_demand || '',
      recommended_park: ent.recommended_park || '', decision_status: ent.decision_status || '',
      progress_update: ent.progress_update || '', project_source: ent.project_source || '',
      investment_lead: ent.investment_lead || '', investment_contact: ent.investment_contact || '',
      first_contact: ent.first_contact || '', related_files: ent.related_files || '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!ent || !form.name || !form.industry) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...form,
        tags: form.tags ? form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      };
      for (const f of ['pre_valuation', 'demand_amount']) {
        const v = payload[f];
        payload[f] = v === '' || v == null ? null : Number(v);
      }
      await enterpriseApi.update(ent.id, payload);
      qc.invalidateQueries({ queryKey: ['enterprise', ent.id] });
      qc.invalidateQueries({ queryKey: ['enterprises'] });
      setEditOpen(false);
    } catch (e) { alert('更新失败: ' + (e as Error).message); }
    finally { setSaving(false); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
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
          <div><span className="text-muted">状态：</span>{ent.status}</div>
          <div><span className="text-muted">联系人：</span>{ent.contact || '-'}</div>
          <div><span className="text-muted">创始人/法人：</span>{ent.founder || '-'}</div>
          <div><span className="text-muted">注册地：</span>{ent.registration || '-'}</div>
          <div><span className="text-muted">负责人：</span>{ent.leader || '-'}</div>
          <div><span className="text-muted">投资负责人：</span>{ent.investment_lead || '-'}</div>
          <div><span className="text-muted">招商对接人：</span>{ent.investment_contact || '-'}</div>
          <div><span className="text-muted">项目来源：</span>{ent.project_source || '-'}</div>
        </div>
        {ent.demand && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">核心需求：</span><span className="text-[13px]">{ent.demand}</span></div>}
        {(chainMemberships && chainMemberships.length > 0) && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-muted text-[13px]">产业链归属：</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {chainMemberships.map(m => (
                <span key={`${m.chain_id}-${m.node_id}`} className="tag tag-blue text-[11px]">
                  {m.chain_name} · {m.node_name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 mb-4">
        <h3 className="font-semibold text-[14px] mb-3">招商推进信息</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
          <div><span className="text-muted">融资轮次：</span>{ent.funding_round || '-'}</div>
          <div><span className="text-muted">投前估值：</span>{ent.pre_valuation != null ? `${ent.pre_valuation} 亿元` : '-'}</div>
          <div><span className="text-muted">需求金额：</span>{ent.demand_amount != null ? `${ent.demand_amount} 万元` : '-'}</div>
          <div><span className="text-muted">招商需求：</span>{ent.space_demand ? `${ent.space_demand} ㎡` : '-'}</div>
          <div><span className="text-muted">决策状态：</span>{ent.decision_status || '-'}</div>
          <div><span className="text-muted">推荐园区：</span>{ent.recommended_park || '-'}</div>
          <div><span className="text-muted">首次拜访：</span>{ent.first_visit || '-'}</div>
          <div><span className="text-muted">首次对接：</span>{ent.first_contact || '-'}</div>
        </div>
        {ent.intro && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">简介（主营/行业地位/营收）：</span><p className="text-[13px] mt-1 whitespace-pre-wrap">{ent.intro}</p></div>}
        {ent.main_business && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">主营业务情况：</span><p className="text-[13px] mt-1 whitespace-pre-wrap">{ent.main_business}</p></div>}
        {ent.progress_update && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">进度更新：</span><p className="text-[13px] mt-1 whitespace-pre-wrap">{ent.progress_update}</p></div>}
        {ent.related_files && <div className="mt-3 pt-3 border-t border-border"><span className="text-muted text-[13px]">相关文件：</span><p className="text-[13px] mt-1 whitespace-pre-wrap">{ent.related_files}</p></div>}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('profile')} className={`btn text-[13px] ${tab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}>📋 企业画像</button>
        <button onClick={() => setTab('match')} className={`btn text-[13px] ${tab === 'match' ? 'btn-primary' : 'btn-secondary'}`}>🔍 资源匹配</button>
        <button onClick={() => setTab('files')} className={`btn text-[13px] ${tab === 'files' ? 'btn-primary' : 'btn-secondary'}`}>📎 附件 ({files?.length || 0})</button>
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-[14px]">企业画像与需求分析</h3>
            <button
              className={`btn text-[13px] ${profileLoading ? 'btn-secondary' : 'btn-primary'}`}
              onClick={runProfile}
              disabled={profileLoading}
            >
              {profileLoading ? '⏳ AI 生成中...' : '🤖 AI 生成画像'}
            </button>
          </div>

          {profileError && (
            <div className="card p-4 text-red-500 text-[13px]">❌ 生成失败：{profileError}</div>
          )}

          {!ent.analysis_text && Object.keys(painPoints).length === 0 && !ent.needs && (
            <div className="card p-8 text-center text-muted">
              <p className="text-2xl mb-2">🤖</p>
              <p>尚未生成 AI 画像</p>
              <p className="text-[12px] mt-1">点击「AI 生成画像」基于企业信息智能分析痛点、需求与投资价值</p>
            </div>
          )}

          {ent.analysis_text && (
            <div className="card p-5">
              <h4 className="font-semibold text-[13px] mb-2">📌 企业概述</h4>
              <p className="text-[13px] text-muted">{ent.analysis_text}</p>
            </div>
          )}

          {ent.needs && (() => {
            const inv = ent.needs as InvestmentAnalysis;
            return (
              <div className="card p-5">
                <h4 className="font-semibold text-[13px] mb-3">📊 投资价值研判</h4>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {inv.rating && <span className="tag tag-green">评级 {inv.rating}</span>}
                  {inv.estimated_investment && <span className="tag tag-blue">预估投资 {inv.estimated_investment}</span>}
                  {inv.job_creation && <span className="tag tag-gray">{inv.job_creation}</span>}
                </div>
                {Array.isArray(inv.highlights) && inv.highlights.length > 0 && (
                  <div className="mb-2">
                    <span className="text-[13px] font-semibold">核心优势</span>
                    <ul className="text-[13px] text-muted list-disc list-inside mt-1">
                      {inv.highlights.map((h, i) => <li key={i}>{h}</li>)}
                    </ul>
                  </div>
                )}
                {Array.isArray(inv.risks) && inv.risks.length > 0 && (
                  <div>
                    <span className="text-[13px] font-semibold">关注风险</span>
                    <ul className="text-[13px] text-muted list-disc list-inside mt-1">
                      {inv.risks.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            );
          })()}

          {Object.keys(painPoints).length > 0 && (
            <div className="card p-5">
              <h4 className="font-semibold text-[13px] mb-3">🎯 多维需求分析</h4>
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
            </div>
          )}
        </div>
      )}

      {tab === 'match' && (
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              className={`btn text-[13px] ${matchLoading === 'policies' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={runPolicyMatch}
              disabled={matchLoading !== null}
            >
              {matchLoading === 'policies' ? '⏳ 匹配中...' : '📜 匹配政策'}
            </button>
            <button
              className={`btn text-[13px] ${matchLoading === 'properties' ? 'btn-secondary' : 'btn-primary'}`}
              onClick={runPropertyMatch}
              disabled={matchLoading !== null}
            >
              {matchLoading === 'properties' ? '⏳ 匹配中...' : '🏗️ 匹配物业'}
            </button>
          </div>

          {/* Error */}
          {matchError && (
            <div className="card p-4 text-red-500 text-[13px]">❌ 匹配失败：{matchError}</div>
          )}

          {/* Policy matches */}
          {policyMatches && (
            <div className="card p-4">
              <h3 className="font-semibold text-[14px] mb-3">📜 政策匹配结果（{policyMatches.length} 项）</h3>
              {policyMatches.length === 0 ? (
                <p className="text-muted text-[13px]">暂无匹配政策</p>
              ) : (
                <div className="space-y-3">
                  {policyMatches.map((m, i) => (
                    <div key={i} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[13px]">{m.resource_name}</span>
                        <span className={`tag ${m.match_score >= 80 ? 'tag-green' : m.match_score >= 60 ? 'tag-blue' : 'tag-gray'}`}>
                          匹配度 {m.match_score}%
                        </span>
                      </div>
                      <p className="text-[12px] text-muted">{m.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Property matches */}
          {propertyMatches && (
            <div className="card p-4">
              <h3 className="font-semibold text-[14px] mb-3">🏗️ 物业匹配结果（{propertyMatches.length} 项）</h3>
              {propertyMatches.length === 0 ? (
                <p className="text-muted text-[13px]">暂无匹配物业</p>
              ) : (
                <div className="space-y-3">
                  {propertyMatches.map((m, i) => (
                    <div key={i} className="border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[13px]">{m.resource_name}</span>
                        <span className={`tag ${m.match_score >= 80 ? 'tag-green' : m.match_score >= 60 ? 'tag-blue' : 'tag-gray'}`}>
                          匹配度 {m.match_score}%
                        </span>
                      </div>
                      <p className="text-[12px] text-muted">{m.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!policyMatches && !propertyMatches && !matchLoading && !matchError && (
            <div className="card p-5 text-center py-8 text-muted">
              <p className="text-2xl mb-2">🔍</p>
              <p>点击上方按钮，开始匹配政策与物业资源</p>
              <p className="text-[12px] mt-1">匹配引擎基于企业标签、行业和需求自动推荐</p>
            </div>
          )}
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-semibold text-[14px]">📎 过程文件 / 附件</h3>
              <div className="flex gap-2 items-center">
                <input
                  className="px-3 py-2 border border-border rounded-md text-[13px] w-44"
                  placeholder="备注（如：BP、尽调报告）"
                  value={fileNote}
                  onChange={(e) => setFileNote(e.target.value)}
                />
                <button className={`btn text-[13px] ${uploading ? 'btn-secondary' : 'btn-primary'}`} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? '⏳ 上传中...' : '⬆ 上传文件'}
                </button>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
              </div>
            </div>

            {filesLoading ? (
              <div className="text-center text-muted py-8">⏳ 加载附件...</div>
            ) : files && files.length > 0 ? (
              <div className="space-y-2">
                {files.map((a) => (
                  <div key={a.id} className="flex items-center justify-between border border-border rounded-md p-3">
                    <div className="min-w-0">
                      <a href={attachmentsApi.downloadUrl(a.id)} target="_blank" rel="noreferrer" className="text-[13px] font-medium hover:underline text-accent truncate block">
                        {a.filename}
                      </a>
                      <div className="text-[11px] text-muted mt-0.5 flex gap-2 flex-wrap">
                        <span className="uppercase">{a.file_type}</span>
                        <span>{(a.size / 1024).toFixed(1)} KB</span>
                        {a.note && <span>· {a.note}</span>}
                        {a.created_at && <span>· {new Date(a.created_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a href={attachmentsApi.downloadUrl(a.id)} target="_blank" rel="noreferrer" className="btn btn-secondary text-[12px]">⬇ 下载</a>
                      <button className="btn btn-secondary text-[12px]" onClick={() => handleDeleteFile(a.id)}>🗑 删除</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted py-8">
                <p className="text-2xl mb-2">📎</p>
                <p>暂无过程文件附件</p>
                <p className="text-[12px] mt-1">上传 BP、尽调报告、会议纪要、扫描件等过程文件，作为该企业招商推进的附件留档，可在线预览/下载</p>
              </div>
            )}
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[12px] text-muted">创始人/法人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.founder || ''} onChange={set('founder')} /></div>
            <div><label className="text-[12px] text-muted">注册地</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.registration || ''} onChange={set('registration')} /></div>
            <div><label className="text-[12px] text-muted">负责人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.leader || ''} onChange={set('leader')} /></div>
            <div><label className="text-[12px] text-muted">投资负责人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.investment_lead || ''} onChange={set('investment_lead')} /></div>
            <div><label className="text-[12px] text-muted">招商对接人</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.investment_contact || ''} onChange={set('investment_contact')} /></div>
            <div><label className="text-[12px] text-muted">项目来源</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.project_source || ''} onChange={set('project_source')} /></div>
            <div><label className="text-[12px] text-muted">融资轮次</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.funding_round || ''} onChange={set('funding_round')} /></div>
            <div><label className="text-[12px] text-muted">投前估值（亿元）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.pre_valuation || ''} onChange={set('pre_valuation')} inputMode="decimal" /></div>
            <div><label className="text-[12px] text-muted">需求金额（万元）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.demand_amount || ''} onChange={set('demand_amount')} inputMode="decimal" /></div>
            <div><label className="text-[12px] text-muted">招商需求（㎡）</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.space_demand || ''} onChange={set('space_demand')} /></div>
            <div><label className="text-[12px] text-muted">决策状态</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.decision_status || ''} onChange={set('decision_status')} /></div>
            <div><label className="text-[12px] text-muted">推荐园区</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.recommended_park || ''} onChange={set('recommended_park')} /></div>
            <div><label className="text-[12px] text-muted">首次拜访</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.first_visit || ''} onChange={set('first_visit')} /></div>
            <div><label className="text-[12px] text-muted">首次对接</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.first_contact || ''} onChange={set('first_contact')} /></div>
          </div>
          <div><label className="text-[12px] text-muted">核心需求</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.demand || ''} onChange={set('demand')} /></div>
          <div><label className="text-[12px] text-muted">简介（主营、行业地位、营收情况）</label><textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={2} value={form.intro || ''} onChange={set('intro')} /></div>
          <div><label className="text-[12px] text-muted">主营业务情况</label><textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={2} value={form.main_business || ''} onChange={set('main_business')} /></div>
          <div><label className="text-[12px] text-muted">进度更新（每两周更新）</label><textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={2} value={form.progress_update || ''} onChange={set('progress_update')} /></div>
          <div><label className="text-[12px] text-muted">相关文件</label><input className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" value={form.related_files || ''} onChange={set('related_files')} /></div>
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
