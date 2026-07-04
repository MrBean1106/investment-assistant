import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '你好！我是产业招商AI助手。我可以帮你：\n\n🔍 搜索企业、查看详情\n📊 分析企业价值、生成画像\n📜 匹配政策资源\n🏗️ 匹配物业资源\n📄 生成研判报告\n➕ 新增企业\n\n直接告诉我你想做什么吧！' },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgHistoryRef = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    const history = [...msgHistoryRef.current, { role: 'user', content: text }];
    msgHistoryRef.current = history;

    try {
      const BASE = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      let assistantContent = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'text') {
              assistantContent += event.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
                return copy;
              });
            } else if (event.type === 'tool_call') {
              const hint = `\n\n🔧 正在执行: ${event.name}...`;
              assistantContent += hint;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
                return copy;
              });
            } else if (event.type === 'tool_result') {
              assistantContent += '\n✅ 数据已获取';
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: assistantContent };
                return copy;
              });
            } else if (event.type === 'error') {
              assistantContent += `\n\n❌ ${event.content}`;
            }
          } catch {}
        }
      }

      msgHistoryRef.current = [...history, { role: 'assistant', content: assistantContent }];
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `❌ 连接失败：${(e as Error).message}。请确认后端服务已启动。` }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <h1 className="page-title">AI 助手</h1>
        <p className="page-subtitle">智能招商顾问 · 支持搜索/分析/匹配/报告</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'text-white'
                  : 'bg-white border text-gray-800'
              }`}
              style={
                m.role === 'user'
                  ? { background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-dark))' }
                  : { borderColor: 'var(--color-border)' }
              }
            >
              {m.content || (streaming && i === messages.length - 1 ? '⏳ 思考中...' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-card)' }}>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="输入问题，Enter 发送..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming}
          />
          <button
            className="btn btn-primary"
            onClick={send}
            disabled={streaming || !input.trim()}
            style={{ minWidth: 80 }}
          >
            {streaming ? '...' : '发送'}
          </button>
        </div>
        <div className="flex gap-3 mt-2.5 flex-wrap">
          {['查企业', '产业图谱', '政策匹配', '生成报告'].map((hint) => (
            <button
              key={hint}
              className="text-[12px] px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              onClick={() => { setInput(hint); }}
              disabled={streaming}
            >
              {hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
