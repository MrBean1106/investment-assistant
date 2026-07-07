import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: { filename: string; content: string }[];
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是产业招商AI助手。我可以帮你：\n\n🔍 搜索企业、查看详情\n📊 分析企业价值、生成画像\n📜 匹配政策资源\n🏗️ 匹配物业资源\n📄 生成研判报告\n📎 上传文件（文本/图片）分析\n\n直接告诉我你想做什么！' },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [uploads, setUploads] = useState<{ filename: string; content: string; file_type: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const msgHistoryRef = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const BASE = 'https://investment-assistant-production-bb06.up.railway.app/api';
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${BASE}/files/upload`, { method: 'POST', body: form });
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
      const BASE = 'https://investment-assistant-production-bb06.up.railway.app/api';
      const res = await fetch(`${BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      let assistantContent = '';
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
              setMessages(prev => { const copy = [...prev]; copy[copy.length - 1] = { role: 'assistant', content: assistantContent }; return copy; });
            } else if (event.type === 'tool_call') {
              assistantContent += `\n\n🔧 正在执行: ${event.name}...`;
            } else if (event.type === 'error') {
              assistantContent += `\n\n❌ ${event.content}`;
            }
          } catch {}
        }
      }
      msgHistoryRef.current = [...history, { role: 'assistant', content: assistantContent }];
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ 连接失败：${(e as Error).message}` }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="page-title">AI 助手</h1>
        <p className="page-subtitle">智能招商顾问 · 支持文件上传分析</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
              m.role === 'user' ? 'text-white' : 'bg-white border text-gray-800'
            }`}
              style={m.role === 'user' ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))' } : { borderColor: 'var(--color-border)' }}
            >
              {m.content || (streaming && i === messages.length - 1 ? '⏳ 思考中...' : '')}
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
