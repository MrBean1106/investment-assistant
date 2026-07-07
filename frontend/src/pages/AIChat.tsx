import { useState, useRef, useEffect } from 'react';
import { API_BASE } from '../api/config';

interface ToolEvent {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: 'calling' | 'done' | 'error';
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: { filename: string; content: string }[];
  tools?: ToolEvent[];
}

const STORAGE_KEY = 'ia-chat-messages-v1';

const WELCOME: Message = {
  role: 'assistant',
  content: '你好！我是产业招商AI助手。我可以帮你：\n\n🔍 搜索企业、查看详情\n📊 分析企业价值、生成画像\n📜 匹配政策资源\n🏗️ 匹配物业资源\n📄 生成研判报告\n📎 上传文件（文本/图片）分析\n\n直接告诉我你想做什么！',
};

const TOOL_LABELS: Record<string, string> = {
  search_enterprises: '搜索企业',
  get_enterprise_detail: '查看企业详情',
  list_policies: '查询政策库',
  list_properties: '查询物业资源',
  get_industry_chain: '查看产业图谱',
  get_dashboard_stats: '获取工作台统计',
  generate_enterprise_profile: '生成企业画像',
  match_policies_for_enterprise: '匹配政策',
  match_properties_for_enterprise: '匹配物业',
  generate_report_for_enterprise: '生成研判报告',
  create_enterprise: '新增企业',
};

function summarizeToolResult(name: string, raw: string): string {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return raw.slice(0, 160) + (raw.length > 160 ? '…' : ''); }

  if (Array.isArray(data)) {
    if (data.length === 0) return '返回 0 项（空）';
    const sample = data.slice(0, 3).map((d) => {
      const obj = d as Record<string, unknown>;
      return obj.name || obj.title || `#${obj.id ?? '?'}`;
    });
    return `返回 ${data.length} 项：${sample.join('、')}${data.length > 3 ? ' 等' : ''}`;
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (obj.error) return `❌ ${obj.error}`;
    if (name === 'get_dashboard_stats') {
      return `企业 ${obj.total_enterprises} · 政策 ${obj.total_policies} · 物业 ${obj.total_properties}`;
    }
    if (obj.success && (obj as Record<string, unknown>).enterprise) {
      const e = (obj as Record<string, { name?: string }>).enterprise;
      return `✅ 已创建：${e.name}`;
    }
    if (obj.report_id) return `✅ 报告已生成（#${obj.report_id}）`;
    if (obj.matches && Array.isArray((obj as { matches?: unknown[] }).matches)) {
      return `匹配 ${((obj as { matches: unknown[] }).matches).length} 项资源`;
    }
    // generic: show first few keys
    const keys = Object.keys(obj).slice(0, 4);
    return keys.map((k) => `${k}: ${typeof obj[k] === 'object' ? '…' : obj[k]}`).join('  ·  ');
  }
  return String(data).slice(0, 160);
}

function ToolCard({ tool }: { tool: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[tool.name] || tool.name;
  return (
    <div className="mt-2 rounded-lg border text-[12px] overflow-hidden" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        onClick={() => setExpanded((v) => !v)}
        style={{ color: 'var(--color-ink-secondary)' }}
      >
        <span className="flex items-center gap-1.5">
          {tool.status === 'calling' ? <span className="animate-pulse">🔧</span> : tool.status === 'error' ? '⚠️' : '✅'}
          <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>{label}</span>
          {tool.status === 'calling' && <span style={{ color: 'var(--color-muted)' }}>执行中…</span>}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>{expanded ? '▾' : '▸'}</span>
      </button>
      {tool.status !== 'calling' && (
        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-ink-secondary)' }}>
          {tool.result ? summarizeToolResult(tool.name, tool.result) : '（无返回）'}
        </div>
      )}
      {expanded && tool.result && (
        <pre className="px-3 py-2 text-[11px] overflow-x-auto whitespace-pre-wrap break-all" style={{ background: '#0f1729', color: '#cbd5e1', borderTop: '1px solid var(--color-border-light)' }}>
          {(() => { try { return JSON.stringify(JSON.parse(tool.result), null, 2); } catch { return tool.result; } })()}
        </pre>
      )}
    </div>
  );
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Message[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { /* ignore */ }
    return [WELCOME];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [uploads, setUploads] = useState<{ filename: string; content: string; file_type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgHistoryRef = useRef<{ role: string; content: string }[]>([]);

  // Persist conversation
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore quota */ }
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const clearChat = () => {
    setMessages([WELCOME]);
    msgHistoryRef.current = [];
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/files/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUploads(prev => [...prev, { filename: data.filename, content: data.content, file_type: data.file_type }]);
    } catch (err) {
      alert('上传失败: ' + (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeUpload = (i: number) => setUploads(prev => prev.filter((_, idx) => idx !== i));

  // Helper: update the last assistant message
  const updateLastAssistant = (fn: (m: Message) => Message) => {
    setMessages(prev => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') copy[copy.length - 1] = fn(last);
      return copy;
    });
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && uploads.length === 0) || streaming) return;

    let fullContent = text;
    if (uploads.length > 0) {
      const ctx = uploads.map(u => `[文件: ${u.filename}]\n${u.content.substring(0, 2000)}`).join('\n---\n');
      fullContent = (text ? text + '\n\n---\n上传文件内容:\n' : '请分析以下文件内容:\n') + ctx;
    }

    setInput('');
    const userMsg: Message = { role: 'user', content: text || '[上传了文件]', attachments: uploads.length > 0 ? uploads : undefined };
    setMessages(prev => [...prev, userMsg]);
    setUploads([]);
    setStreaming(true);

    const history = [...msgHistoryRef.current, { role: 'user', content: fullContent }];
    msgHistoryRef.current = history;

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      let assistantContent = '';
      const assistantTools: ToolEvent[] = [];
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const d = line.slice(6);
          if (d === '[DONE]') continue;
          try {
            const event = JSON.parse(d);
            if (event.type === 'text') {
              assistantContent += event.content;
              updateLastAssistant(m => ({ ...m, content: assistantContent }));
            } else if (event.type === 'tool_call') {
              assistantTools.push({ name: event.name, args: event.args, status: 'calling' });
              updateLastAssistant(m => ({ ...m, tools: [...assistantTools] }));
            } else if (event.type === 'tool_result') {
              const idx = assistantTools.findIndex(t => t.name === event.name && t.status === 'calling');
              if (idx >= 0) {
                assistantTools[idx] = { ...assistantTools[idx], result: event.content, status: 'done' };
              } else {
                assistantTools.push({ name: event.name, result: event.content, status: 'done' });
              }
              updateLastAssistant(m => ({ ...m, tools: [...assistantTools] }));
            } else if (event.type === 'error') {
              assistantContent += `\n\n❌ ${event.content}`;
              updateLastAssistant(m => ({ ...m, content: assistantContent }));
            }
          } catch { /* ignore malformed SSE line */ }
        }
      }
      msgHistoryRef.current = [...history, { role: 'assistant', content: assistantContent }];
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ 连接失败：${(e as Error).message}\n\n请确认后端服务已启动（localhost:8001）且已配置 DEEPSEEK_API_KEY。` }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <h1 className="page-title">AI 助手</h1>
          <p className="page-subtitle">智能招商顾问 · 支持文件上传与工具调用</p>
        </div>
        <button className="btn btn-ghost text-[12px]" onClick={clearChat} disabled={streaming}>清空对话</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ? 'text-white' : 'bg-white border text-gray-800'
            }`}
              style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))' } : { borderColor: 'var(--color-border)' }}
            >
              {m.content || (streaming && i === messages.length - 1 && !(m.tools?.length) ? '⏳ 思考中...' : '')}
              {m.tools && m.tools.length > 0 && m.tools.map((t, j) => <ToolCard key={j} tool={t} />)}
              {m.attachments && m.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.attachments.map((a, j) => (
                    <span key={j} className="text-[11px] px-2 py-0.5 rounded bg-white/20">📎 {a.filename}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Upload preview */}
      {uploads.length > 0 && (
        <div className="px-6 py-2 flex flex-wrap gap-2 border-t" style={{ borderColor: 'var(--color-border-light)', background: '#f8fafc' }}>
          {uploads.map((u, i) => (
            <span key={i} className="tag tag-blue flex items-center gap-1 text-[11px]">
              {u.file_type === 'image' ? '🖼' : '📄'} {u.filename}
              <button onClick={() => removeUpload(i)} className="hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="输入问题，支持上传文件分析..."
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={streaming} />
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".txt,.md,.pdf,.csv,.json,.png,.jpg,.jpeg,.gif,.webp" />
          <button className="btn btn-secondary text-[12px]" onClick={() => fileRef.current?.click()} disabled={streaming || uploading}>
            {uploading ? '⏳' : '📎'}
          </button>
          <button className="btn btn-primary" onClick={send} disabled={streaming || (!input.trim() && uploads.length === 0)} style={{ minWidth: 80 }}>
            {streaming ? '...' : '发送'}
          </button>
        </div>
        <div className="flex gap-3 mt-2.5 flex-wrap">
          {['查企业', '产业图谱', '政策匹配', '生成报告'].map(h => (
            <button key={h} className="text-[12px] px-3 py-1.5 rounded-lg font-medium"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              onClick={() => setInput(h)} disabled={streaming}>{h}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
