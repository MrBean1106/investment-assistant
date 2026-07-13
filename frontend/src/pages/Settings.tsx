import { useEffect, useState } from 'react';
import { settingsApi, type LlmSettings } from '../api/settings';

interface Preset {
  name: string;
  base_url: string;
  model: string;
}

const PRESETS: Preset[] = [
  { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: '通义千问', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: '智谱 GLM', base_url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
];

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.deepseek.com/v1');
  const [model, setModel] = useState('deepseek-chat');

  const [maskedKey, setMaskedKey] = useState('');
  const [source, setSource] = useState('');
  const [configured, setConfigured] = useState(false);
  const [note, setNote] = useState('');

  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const load = async () => {
    try {
      const s: LlmSettings = await settingsApi.getLlm();
      setBaseUrl(s.base_url);
      setModel(s.model);
      setMaskedKey(s.masked_key);
      setSource(s.source);
      setConfigured(s.configured);
    } catch (e) {
      alert('加载设置失败: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const res = await settingsApi.saveLlm({
        api_key: apiKey || null,
        base_url: baseUrl,
        model: model,
      });
      setConfigured(res.configured);
      setSource(res.source);
      setMaskedKey(res.masked_key);
      setNote(res.note || '');
      setApiKey('');
      alert('已保存配置');
      await load();
    } catch (e) {
      alert('保存失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('确定清除已保存的 API Key 吗？')) return;
    setSaving(true);
    try {
      const res = await settingsApi.saveLlm({ clear_key: true, base_url: baseUrl, model: model });
      setConfigured(res.configured);
      setSource(res.source);
      setMaskedKey(res.masked_key);
      setApiKey('');
      alert('已清除 API Key');
      await load();
    } catch (e) {
      alert('清除失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await settingsApi.testLlm({ api_key: apiKey || null, base_url: baseUrl, model: model });
      setTestResult(res);
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm" style={{ color: 'var(--color-muted)' }}>加载中…</div>;
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ink)' }}>系统设置</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          配置大模型 API，启用 AI 助手对话、企业画像生成与招商研判报告等能力。
        </p>
      </div>

      {/* 状态横幅 */}
      <div
        className="rounded-xl border p-4 mb-6 text-sm"
        style={
          configured
            ? { borderColor: '#bbf7d0', background: '#f0fdf4', color: '#166534' }
            : { borderColor: '#fde68a', background: '#fffbeb', color: '#92400e' }
        }
      >
        {configured ? (
          <span>
            大模型已配置（来源：{source === 'env' ? '环境变量' : '应用内设置'}）
            {maskedKey && ` · 当前 Key：${maskedKey}`}
          </span>
        ) : (
          <span>尚未配置大模型 API，AI 相关功能将使用内置规则引擎兜底（不调用大模型）。</span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-ink)' }}>大模型 API 配置</h2>

        {/* API Key */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-ink)' }}>
            API Key
          </label>
          <div className="relative">
            <input
              className="input pr-20"
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入新的 API Key（留空则不修改已保存的值）"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          {maskedKey && (
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>已保存：{maskedKey}</span>
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={handleClear}>
                清除
              </button>
            </div>
          )}
        </div>

        {/* Base URL */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-ink)' }}>
            API Base URL
          </label>
          <input
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.deepseek.com/v1"
          />
        </div>

        {/* Model */}
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-ink)' }}>
            模型名称
          </label>
          <input
            className="input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-chat"
          />
        </div>

        {/* 服务商预设 */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-ink)' }}>
            快速匹配服务商（仅填充地址与模型，不影响 Key）
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="btn btn-secondary text-[12px] px-3 py-1.5"
                onClick={() => {
                  setBaseUrl(p.base_url);
                  setModel(p.model);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {note && <div className="text-xs text-amber-600 mb-4">{note}</div>}

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? '保存中...' : '保存配置'}
          </button>
          <button className="btn btn-secondary" disabled={testing} onClick={handleTest}>
            {testing ? '测试中...' : '测试连接'}
          </button>
        </div>

        {testResult && (
          <div
            className="mt-4 rounded-lg p-3 text-sm"
            style={
              testResult.ok
                ? { background: '#f0fdf4', color: '#166534' }
                : { background: '#fef2f2', color: '#b91c1c' }
            }
          >
            {testResult.ok ? '✓ ' : '✗ '}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
