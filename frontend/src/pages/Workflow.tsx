import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import { useEnterprise } from '../hooks/useEnterprises';
import { useQueryClient } from '@tanstack/react-query';
import { enterpriseApi } from '../api/enterprises';
import { useGenerateProfile, useMatchPolicies, useMatchProperties, useGenerateReport } from '../hooks/useAI';
import type { ProfileResponse, MatchResponse, ReportResponse } from '../api/ai';

const STEPS = [
  { id: 1, label: '信息搜集', icon: '📝', desc: '企业信息确认' },
  { id: 2, label: '企业画像', icon: '🎯', desc: 'AI 痛点与需求分析' },
  { id: 3, label: '资源匹配', icon: '🔍', desc: '政策 & 物业智能匹配' },
  { id: 4, label: '投资研判', icon: '📊', desc: '投资价值分析' },
  { id: 5, label: '报告生成', icon: '📄', desc: '招商研判报告' },
  { id: 6, label: '服务维护', icon: '🔄', desc: '更新企业库信息' },
];

function StepIndicator({ step, setStep }: { step: number; setStep: (s: number) => void }) {
  return (
    <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setStep(s.id)}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-semibold transition-all ${
              s.id < step
                ? 'bg-accent text-white'
                : s.id === step
                  ? 'bg-accent text-white ring-2 ring-accent/30'
                  : 'bg-gray-100 text-muted'
            }`}
          >
            {s.id < step ? '✓' : s.icon}
          </button>
          <div className="hidden sm:block">
            <div className={`text-[12px] font-medium ${s.id <= step ? 'text-accent' : 'text-muted'}`}>{s.label}</div>
            <div className="text-[11px] text-muted">{s.desc}</div>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-10 h-0.5 flex-shrink-0 ${s.id < step ? 'bg-accent' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Workflow() {
  const { enterpriseId } = useParams<{ enterpriseId: string }>();
  const eid = Number(enterpriseId);
  const { data: ent, isLoading: entLoading } = useEnterprise(eid);
  const [step, setStep] = useState(1);

  // AI states
  const [profile, setProfile] = useState<ProfileResponse['profile'] | null>(null);
  const [policyMatches, setPolicyMatches] = useState<MatchResponse | null>(null);
  const [propertyMatches, setPropertyMatches] = useState<MatchResponse | null>(null);
  const [report, setReport] = useState<ReportResponse['report'] | null>(null);

  const profileMut = useGenerateProfile();
  const policyMut = useMatchPolicies();
  const propertyMut = useMatchProperties();
  const reportMut = useGenerateReport();
  const qc = useQueryClient();

  // Step 6 maintenance state
  const [maintStatus, setMaintStatus] = useState('');
  const [maintNote, setMaintNote] = useState('');
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintDone, setMaintDone] = useState(false);

  if (entLoading) return <div className="p-8 text-center text-muted">⏳ 加载企业数据...</div>;
  if (!ent) return <div className="p-8 text-muted">企业不存在</div>;

  const handleGenerateProfile = () => {
    profileMut.mutate(eid, {
      onSuccess: (data) => {
        setProfile(data.profile);
        setStep(3); // Auto-advance
      },
    });
  };

  const handleMatchPolicies = () => {
    policyMut.mutate(eid, {
      onSuccess: (data) => setPolicyMatches(data),
    });
  };

  const handleMatchProperties = () => {
    propertyMut.mutate(eid, {
      onSuccess: (data) => setPropertyMatches(data),
    });
  };

  const handleGenerateReport = () => {
    reportMut.mutate(eid, {
      onSuccess: (data) => setReport(data.report),
    });
  };

  const isGenerating = profileMut.isPending || policyMut.isPending || propertyMut.isPending || reportMut.isPending;

  return (
    <div className="p-8 max-w-4xl">
      <Link to={`/enterprises/${enterpriseId}`} className="text-[13px] text-accent mb-4 inline-block hover:underline">
        ← 返回企业详情
      </Link>

      <h1 className="text-xl font-bold mb-1">招商工作流</h1>
      <p className="text-[14px] text-muted mb-2">{ent.name} · {ent.industry}</p>

      {/* AI Notice */}
      <div className="text-[12px] text-muted mb-4 bg-[#fefce8] border border-[#fde68a] rounded-md px-3 py-2">
        💡 当前使用<b>规则引擎</b>进行分析。设置 <code className="bg-[#fef3c7] px-1 rounded">DEEPSEEK_API_KEY</code> 环境变量可启用 AI 大模型深度分析。
      </div>

      <StepIndicator step={step} setStep={setStep} />

      {/* ── Step 1: Enterprise Info ── */}
      {step === 1 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[15px] mb-4">步骤 1：企业信息确认</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { l: '企业名称', v: ent.name }, { l: '所属行业', v: ent.industry },
              { l: '细分领域', v: ent.segment || '-' }, { l: '所在地区', v: ent.region || '-' },
              { l: '企业规模', v: ent.scale || '-' }, { l: '联系人', v: ent.contact || '-' },
            ].map((f) => (
              <div key={f.l}><span className="text-[12px] text-muted">{f.l}</span><div className="text-[14px] font-medium mt-0.5">{f.v}</div></div>
            ))}
          </div>
          <div className="flex gap-2 mb-2">{ent.tags?.map((t) => <span key={t} className="tag tag-blue">{t}</span>)}</div>
          <div className="bg-[#fafaf8] border border-border rounded-md p-3 mb-4">
            <div className="text-[12px] text-muted mb-1">💬 核心需求</div>
            <p className="text-[13px]">{ent.demand || '待补充'}</p>
          </div>
        </div>
      )}

      {/* ── Step 2: Profile Generation ── */}
      {step === 2 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[15px] mb-4">步骤 2：AI 企业画像生成</h2>

          {!profile && (
            <div className="text-center py-8">
              <p className="text-3xl mb-3">🤖</p>
              <p className="text-muted mb-4">点击下方按钮，AI 将自动分析企业痛点与多维需求</p>
              <button
                className="btn btn-primary text-[14px] px-6"
                onClick={handleGenerateProfile}
                disabled={profileMut.isPending}
              >
                {profileMut.isPending ? '⏳ AI 分析中...' : '🚀 生成企业画像'}
              </button>
              {profileMut.isError && (
                <p className="text-red-500 text-[13px] mt-2">生成失败：{profileMut.error?.message}</p>
              )}
            </div>
          )}

          {profile && (
            <div>
              <div className="bg-[#f0f7ff] border border-[#bfdbfe] rounded-md p-3 mb-4">
                <span className="text-[13px] font-medium text-accent">📋 AI 分析摘要：</span>
                <span className="text-[13px]">{profile.summary}</span>
              </div>

              <h3 className="font-semibold text-[14px] mb-2">痛点与需求分析</h3>
              <div className="space-y-2 mb-4">
                {Object.entries(profile.pain_points).map(([cat, items]) => (
                  <div key={cat} className="border border-border rounded-md p-3">
                    <span className="text-[13px] font-semibold">{cat}</span>
                    {items.length > 0 ? (
                      <ul className="text-[13px] text-muted list-disc list-inside mt-1">
                        {items.map((it, i) => <li key={i}>{it}</li>)}
                      </ul>
                    ) : (
                      <p className="text-[12px] text-muted mt-1">暂无明显需求</p>
                    )}
                  </div>
                ))}
              </div>

              {profile.investment_analysis && (
                <div className="mt-3 pt-3 border-t border-border">
                  <h3 className="font-semibold text-[14px] mb-2">初步投资研判</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface border border-border rounded-md p-3 text-center">
                      <div className="text-[11px] text-muted">投资评级</div>
                      <div className="text-xl font-bold text-accent">{profile.investment_analysis.rating}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-md p-3 text-center">
                      <div className="text-[11px] text-muted">预估投资</div>
                      <div className="text-[14px] font-bold">{profile.investment_analysis.estimated_investment}</div>
                    </div>
                    <div className="bg-surface border border-border rounded-md p-3 text-center">
                      <div className="text-[11px] text-muted">带动就业</div>
                      <div className="text-[14px] font-bold">{profile.investment_analysis.job_creation}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-right mt-4">
                <button className="text-[12px] text-accent hover:underline" onClick={handleGenerateProfile} disabled={profileMut.isPending}>
                  🔄 重新生成
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Resource Matching ── */}
      {step === 3 && (
        <div className="space-y-4">
          {/* Policy Match */}
          <div className="card p-6">
            <h2 className="font-semibold text-[15px] mb-4">📜 政策智能匹配</h2>
            {!policyMatches && (
              <div className="text-center py-6">
                <button
                  className="btn btn-primary"
                  onClick={handleMatchPolicies}
                  disabled={policyMut.isPending}
                >
                  {policyMut.isPending ? '⏳ 匹配中...' : '🔍 开始政策匹配'}
                </button>
                {policyMut.isError && <p className="text-red-500 text-[13px] mt-2">{policyMut.error?.message}</p>}
              </div>
            )}
            {policyMatches && (
              <div>
                <p className="text-[13px] text-accent mb-3">{policyMatches.matches.summary}</p>
                <div className="space-y-2">
                  {policyMatches.matches.matches.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-md">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-bold ${
                        m.match_score >= 80 ? 'bg-green-100 text-green-700' :
                        m.match_score >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {m.match_score}%
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-medium">{m.resource_name}</div>
                        <div className="text-[12px] text-muted">{m.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="text-[12px] text-accent hover:underline mt-3" onClick={handleMatchPolicies} disabled={policyMut.isPending}>
                  🔄 重新匹配
                </button>
              </div>
            )}
          </div>

          {/* Property Match */}
          <div className="card p-6">
            <h2 className="font-semibold text-[15px] mb-4">🏗️ 物业智能匹配</h2>
            {!propertyMatches && (
              <div className="text-center py-6">
                <button
                  className="btn btn-primary"
                  onClick={handleMatchProperties}
                  disabled={propertyMut.isPending}
                >
                  {propertyMut.isPending ? '⏳ 匹配中...' : '🔍 开始物业匹配'}
                </button>
                {propertyMut.isError && <p className="text-red-500 text-[13px] mt-2">{propertyMut.error?.message}</p>}
              </div>
            )}
            {propertyMatches && (
              <div>
                <p className="text-[13px] text-accent mb-3">{propertyMatches.matches.summary}</p>
                <div className="grid grid-cols-2 gap-3">
                  {propertyMatches.matches.matches.map((m, i) => (
                    <div key={i} className="p-3 border border-border rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium">{m.resource_name}</span>
                        <span className={`tag text-[11px] ${
                          m.match_score >= 80 ? 'tag-green' : m.match_score >= 60 ? 'tag-blue' : 'tag-gray'
                        }`}>{m.match_score}%</span>
                      </div>
                      <div className="text-[12px] text-muted">{m.reason}</div>
                    </div>
                  ))}
                </div>
                <button className="text-[12px] text-accent hover:underline mt-3" onClick={handleMatchProperties} disabled={propertyMut.isPending}>
                  🔄 重新匹配
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 4: Investment Assessment ── */}
      {step === 4 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[15px] mb-4">步骤 4：投资价值研判</h2>
          {profile?.investment_analysis ? (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {[
                  { l: '综合评级', v: profile.investment_analysis.rating, c: 'text-accent' },
                  { l: '企业规模', v: ent.scale || '-' },
                  { l: '产业位置', v: ent.segment || '-' },
                  { l: '预估投资', v: profile.investment_analysis.estimated_investment },
                  { l: '带动就业', v: profile.investment_analysis.job_creation },
                  { l: '招商状态', v: ent.status },
                ].map((d) => (
                  <div key={d.l} className="border border-border rounded-md p-3 text-center">
                    <div className="text-[11px] text-muted">{d.l}</div>
                    <div className={`text-[16px] font-bold mt-1 ${d.c || ''}`}>{d.v}</div>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold text-[14px] mb-2">优势亮点</h3>
              <ul className="text-[13px] text-muted list-disc list-inside mb-3">
                {profile.investment_analysis.highlights.map((h, i) => <li key={i}>{h}</li>)}
              </ul>

              <h3 className="font-semibold text-[14px] mb-2">风险提示</h3>
              <ul className="text-[13px] text-muted list-disc list-inside">
                {profile.investment_analysis.risks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          ) : (
            <div className="text-center py-8 text-muted">
              <p className="text-2xl mb-2">📊</p>
              <p>请先在步骤 2 中生成企业画像</p>
              <button className="text-accent text-[13px] mt-2 hover:underline" onClick={() => setStep(2)}>
                返回步骤 2 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 5: Report Generation ── */}
      {step === 5 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[15px] mb-4">步骤 5：招商研判报告</h2>

          {!report && (
            <div className="text-center py-8">
              <p className="text-3xl mb-3">📄</p>
              <p className="text-muted mb-4">基于企业画像和匹配结果，AI 将自动生成招商研判报告</p>
              <button
                className="btn btn-primary text-[14px] px-6"
                onClick={handleGenerateReport}
                disabled={reportMut.isPending}
              >
                {reportMut.isPending ? '⏳ AI 生成中...' : '📝 生成招商研判报告'}
              </button>
              {reportMut.isError && <p className="text-red-500 text-[13px] mt-2">{reportMut.error?.message}</p>}
            </div>
          )}

          {report && (
            <div>
              <div className="bg-[#fafaf8] border border-border rounded-md p-6 font-serif text-[14px] leading-relaxed">
                <h3 className="text-center font-bold text-[16px] mb-4">{report.title}</h3>
                {report.sections.map((sec, i) => (
                  <div key={i} className="mb-4">
                    <div className="text-[13px] font-semibold text-muted mb-1">{sec.heading}</div>
                    <p className="text-[14px] whitespace-pre-line">{sec.content}</p>
                  </div>
                ))}
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="font-medium">{report.conclusion}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border text-[11px] text-muted text-right">
                  生成时间：{new Date().toLocaleDateString('zh-CN')} · AI辅助生成 · 仅供参考
                </div>
              </div>

              <button className="text-[12px] text-accent hover:underline mt-3" onClick={handleGenerateReport} disabled={reportMut.isPending}>
                🔄 重新生成
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 6: Enterprise Maintenance ── */}
      {step === 6 && (
        <div className="card p-6">
          <h2 className="font-semibold text-[15px] mb-4">步骤 6：企业服务与维护</h2>
          <p className="text-[13px] text-muted mb-4">完成招商流程后，更新企业库中的企业状态和跟进记录</p>

          {maintDone ? (
            <div className="text-center py-6">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-green-600 font-medium">企业信息已更新！</p>
              <p className="text-[13px] text-muted mt-1">状态已更新为「{maintStatus || ent.status}」</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-[#fafaf8] border border-border rounded-md p-4">
                <h3 className="text-[13px] font-semibold mb-3">当前企业状态</h3>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div><span className="text-muted">当前阶段：</span><span className="tag tag-blue ml-1">{ent.status}</span></div>
                  <div><span className="text-muted">投资评级：</span><span className="font-semibold ml-1">{ent.invest_rating || '—'}</span></div>
                  <div><span className="text-muted">报告已生成：</span>{report ? '✅ 是' : '❌ 否'}</div>
                  <div><span className="text-muted">匹配已完成：</span>{policyMatches ? '✅ 是' : '❌ 否'}</div>
                </div>
              </div>

              <div>
                <label className="text-[12px] text-muted">更新招商阶段</label>
                <select className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5 bg-white"
                  value={maintStatus || ent.status} onChange={(e) => setMaintStatus(e.target.value)}>
                  <option>线索</option><option>洽谈中</option><option>已签约</option><option>已落地</option>
                </select>
              </div>

              <div>
                <label className="text-[12px] text-muted">跟进备注</label>
                <textarea className="w-full px-3 py-2 border border-border rounded-md text-[13px] mt-0.5" rows={3}
                  value={maintNote} onChange={(e) => setMaintNote(e.target.value)}
                  placeholder="记录本次招商对接要点、下一步计划..." />
              </div>

              <button className="btn btn-primary"
                onClick={async () => {
                  setMaintSaving(true);
                  try {
                    const newStatus = maintStatus || ent.status;
                    await enterpriseApi.update(eid, {
                      status: newStatus,
                      analysis_text: (ent.analysis_text || '') + `\n[${new Date().toLocaleDateString('zh-CN')}] ${maintNote || '招商流程完成，企业信息已更新'}`,
                    });
                    qc.invalidateQueries({ queryKey: ['enterprise', eid] });
                    qc.invalidateQueries({ queryKey: ['enterprises'] });
                    setMaintDone(true);
                  } catch (e) { alert('更新失败: ' + (e as Error).message); }
                  finally { setMaintSaving(false); }
                }}
                disabled={maintSaving}>
                {maintSaving ? '⏳ 保存中...' : '💾 更新企业库'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <button className="btn btn-secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
          ← 上一步
        </button>
        {step < 6 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {isGenerating ? '⏳ 处理中...' : '下一步 →'}
          </button>
        ) : (
          <Link to={`/enterprises/${enterpriseId}`} className="btn btn-primary">
            ✅ 完成 · 回企业详情
          </Link>
        )}
      </div>
    </div>
  );
}
