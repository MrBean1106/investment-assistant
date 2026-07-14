import { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../api/config';
import { generateId, parseSSEStream } from '../utils/aiChat';
import ToolCard from '../components/ToolCard';
import type { ToolEvent } from '../components/ToolCard';

// ── Types ──
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;          // display content
  apiContent?: string;      // content sent to API (with file context); falls back to content
  attachments?: { filename: string; content: string }[];
  tools?: ToolEvent[];
}

interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

// ── Constants ──
const CONV_STORAGE_KEY = 'ia-chat-conversations-v1';
const CURRENT_ID_KEY = 'ia-chat-current-id-v1';
const LEGACY_KEY = 'ia-chat-messages-v1';

const WELCOME: Message = {
  role: 'assistant',
  content: '你好！我是产业招商AI助手。我可以帮你：\n\n🔍 搜索企业、查看详情\n📊 分析企业价值、生成画像\n📜 匹配政策资源\n🏗️ 匹配物业资源\n📄 生成研判报告\n📎 上传文件（文本/图片/PDF）分析\n\n直接告诉我你想做什么！',
};

// ── Helpers ──
function deriveTitle(msgs: Message[]): string {
  const firstUser = msgs.find((m) => m.role === 'user');
  if (!firstUser) return '新对话';
  const t = (firstUser.content || '新对话').replace(/\s+/g, ' ').trim();
  return t.length > 22 ? t.slice(0, 22) + '…' : t;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function buildApiHistory(msgs: Message[]): { role: string; content: string }[] {
  return msgs.map((m) => ({ role: m.role, content: m.apiContent ?? m.content }));
}

function newConversation(): Conversation {
  const now = Date.now();
  return { id: generateId(), title: '新对话', createdAt: now, updatedAt: now, messages: [] };
}

// ── Storage: load with legacy migration ──
function loadInitial(): { conversations: Conversation[]; currentId: string } {
  try {
    const saved = localStorage.getItem(CONV_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Conversation[];
      if (Array.isArray(parsed)) {
        const cid = localStorage.getItem(CURRENT_ID_KEY) || (parsed[0]?.id ?? '');
        return { conversations: parsed, currentId: cid };
      }
    }
  } catch { /* ignore */ }
  // Migrate legacy single-conversation storage
  try {
    const old = localStorage.getItem(LEGACY_KEY);
    if (old) {
      const oldMsgs = JSON.parse(old) as Message[];
      const start = oldMsgs[0] && oldMsgs[0].content === WELCOME.content ? 1 : 0;
      const msgs = oldMsgs.slice(start);
      if (msgs.length > 0) {
        const conv: Conversation = {
          id: generateId(), title: deriveTitle(msgs),
          createdAt: Date.now(), updatedAt: Date.now(), messages: msgs,
        };
        localStorage.removeItem(LEGACY_KEY);
        return { conversations: [conv], currentId: conv.id };
      }
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch { /* ignore */ }
  return { conversations: [], currentId: '' };
}

export default function AIChat() {
  const initial = useMemo(loadInitial, []);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    initial.conversations.length > 0 ? initial.conversations : [newConversation()]
  );
  const [currentId, setCurrentId] = useState<string>(() =>
    initial.currentId && initial.conversations.some((c) => c.id === initial.currentId)
      ? initial.currentId
      : (initial.conversations[0]?.id ?? conversations[0]?.id ?? '')
  );

  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const qc = useQueryClient();
  const [uploads, setUploads] = useState<{ filename: string; content: string; file_type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const current = conversations.find((c) => c.id === currentId) ?? conversations[0];
  const messages = current?.messages ?? [];
  const displayMessages = messages.length > 0 ? messages : [WELCOME];

  // Persist conversations + current id
  useEffect(() => {
    try {
      localStorage.setItem(CONV_STORAGE_KEY, JSON.stringify(conversations));
      if (currentId) localStorage.setItem(CURRENT_ID_KEY, currentId);
    } catch { /* ignore quota */ }
  }, [conversations, currentId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [displayMessages]);

  // ── Conversation actions ──
  const createConversation = () => {
    const c = newConversation();
    setConversations((prev) => [c, ...prev]);
    setCurrentId(c.id);
  };

  const selectConversation = (id: string) => {
    if (streaming) return;
    setCurrentId(id);
  };

  const deleteConversation = (id: string) => {
    if (streaming) return;
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === currentId) {
        setCurrentId(next[0]?.id ?? '');
      }
      if (next.length === 0) {
        const c = newConversation();
        setCurrentId(c.id);
        return [c];
      }
      return next;
    });
  };

  // Patch the current conversation's messages (and metadata)
  const patchCurrent = (updater: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === currentId ? updater(c) : c)));
  };

  const updateLastAssistant = (fn: (m: Message) => Message) => {
    patchCurrent((c) => {
      const copy = [...c.messages];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') copy[copy.length - 1] = fn(last);
      return { ...c, messages: copy, updatedAt: Date.now() };
    });
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
      setUploads((prev) => [...prev, { filename: data.filename, content: data.content, file_type: data.file_type }]);
    } catch (err) {
      alert('上传失败: ' + (err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeUpload = (i: number) => setUploads((prev) => prev.filter((_, idx) => idx !== i));

  const send = async () => {
    const text = input.trim();
    if ((!text && uploads.length === 0) || streaming || !current) return;

    let fullContent = text;
    if (uploads.length > 0) {
      const ctx = uploads.map((u) => {
        const limit = u.file_type === 'pdf' ? 6000 : 2000;
        return `[文件: ${u.filename}]\n${u.content.substring(0, limit)}`;
      }).join('\n---\n');
      fullContent = (text ? text + '\n\n---\n上传文件内容:\n' : '请分析以下文件内容:\n') + ctx;
    }

    setInput('');
    const userMsg: Message = {
      role: 'user',
      content: text || '[上传了文件]',
      apiContent: fullContent,
      attachments: uploads.length > 0 ? uploads : undefined,
    };

    // Build API history from existing messages + new user message
    const apiHistory = [...buildApiHistory(current.messages), { role: 'user', content: fullContent }];

    // Append user + empty assistant message; set title if first message
    const isFirst = current.messages.length === 0;
    patchCurrent((c) => ({
      ...c,
      title: isFirst ? deriveTitle([userMsg]) : c.title,
      messages: [...c.messages, userMsg, { role: 'assistant', content: '' }],
      updatedAt: Date.now(),
    }));
    setUploads([]);
    setStreaming(true);

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiHistory }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      let assistantContent = '';
      const assistantTools: ToolEvent[] = [];

      await parseSSEStream(reader, {
        onText: (content) => {
          assistantContent += content;
          updateLastAssistant(m => ({ ...m, content: assistantContent, apiContent: assistantContent }));
        },
        onToolCall: (name, args) => {
          assistantTools.push({ name, args, status: 'calling' });
          updateLastAssistant(m => ({ ...m, tools: [...assistantTools] }));
        },
        onToolResult: (name, content) => {
          const idx = assistantTools.findIndex(t => t.name === name && t.status === 'calling');
          if (idx >= 0) {
            assistantTools[idx] = { ...assistantTools[idx], result: content, status: 'done' };
          } else {
            assistantTools.push({ name, result: content, status: 'done' });
          }
          updateLastAssistant(m => ({ ...m, tools: [...assistantTools] }));
          // AI 新增/修改企业后，刷新企业库缓存，确保「企业库」页面能看到最新数据
          if (name === 'create_enterprise') {
            qc.invalidateQueries({ queryKey: ['enterprises'] });
          }
        },
        onError: (content) => {
          assistantContent += `\n\n❌ ${content}`;
          updateLastAssistant(m => ({ ...m, content: assistantContent, apiContent: assistantContent }));
        },
      });

    } catch (e) {
      updateLastAssistant(() => ({
        role: 'assistant',
        content: `❌ 连接失败：${(e as Error).message}\n\n请确认后端服务已启动且已配置 DEEPSEEK_API_KEY。`,
      }));
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Sorted newest-first for the history panel
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex h-full">
      {/* ── History panel ── */}
      <aside className="w-[244px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div className="px-4 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border-light)' }}>
          <div>
            <div className="text-[13px] font-bold" style={{ color: 'var(--color-ink)' }}>对话历史</div>
            <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{conversations.length} 段对话</div>
          </div>
          <button className="btn btn-primary text-[12px] !px-2.5 !py-1.5" onClick={createConversation} disabled={streaming} title="新建对话">＋ 新建</button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {sortedConversations.map((c) => {
            const active = c.id === currentId;
            return (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${active ? '' : 'hover:bg-slate-50'}`}
                style={active ? { background: 'var(--color-accent-light)' } : {}}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate" style={{ color: active ? 'var(--color-accent-dark)' : 'var(--color-ink)' }}>
                    {c.title || '新对话'}
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--color-muted)' }}>
                    {relativeTime(c.updatedAt)} · {c.messages.filter((m) => m.role !== 'system').length} 条
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-[14px] px-1 transition-opacity"
                  style={{ color: 'var(--color-muted)' }}
                  title="删除对话"
                >×</button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h1 className="page-title truncate">AI 助手</h1>
            <p className="page-subtitle truncate">{current?.title || '智能招商顾问 · 支持文件上传与工具调用'}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {displayMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'text-white' : 'bg-white border text-gray-800'
                }`}
                  style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))' } : { borderColor: 'var(--color-border)' }}
                >
                  {m.content || (streaming && i === displayMessages.length - 1 && !(m.tools?.length) ? '⏳ 思考中...' : '')}
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
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="输入问题，支持上传文件分析..."
                value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} disabled={streaming} />
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".txt,.md,.pdf,.csv,.json,.png,.jpg,.jpeg,.gif,.webp" />
              <button className="btn btn-secondary text-[12px]" onClick={() => fileRef.current?.click()} disabled={streaming || uploading}>
                {uploading ? '⏳' : '📎'}
              </button>
              <button className="btn btn-primary" onClick={send} disabled={streaming || (!input.trim() && uploads.length === 0)} style={{ minWidth: 80 }}>
                {streaming ? '...' : '发送'}
              </button>
            </div>
            <div className="flex gap-3 mt-2.5 flex-wrap">
              {['查企业', '产业图谱', '政策匹配', '生成报告'].map((h) => (
                <button key={h} className="text-[12px] px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
                  onClick={() => setInput(h)} disabled={streaming}>{h}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
