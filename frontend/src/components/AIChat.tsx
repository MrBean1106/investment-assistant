import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCall?: { name: string; args: Record<string, unknown> };
  toolResult?: string;
  isStreaming?: boolean;
}

// Tool name translations for display
const TOOL_LABELS: Record<string, string> = {
  search_enterprises: '搜索企业',
  get_enterprise_detail: '查看企业详情',
  list_policies: '查看政策列表',
  list_properties: '查看物业资源',
  get_industry_chain: '查看产业图谱',
  get_dashboard_stats: '查看数据统计',
  generate_enterprise_profile: '生成企业画像',
  match_policies_for_enterprise: '匹配政策',
  match_properties_for_enterprise: '匹配物业',
  generate_report_for_enterprise: '生成研判报告',
  create_enterprise: '新增企业',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: Message = { id: generateId(), role: 'user', content: text };
    const assistantMsg: Message = { id: generateId(), role: 'assistant', content: '', isStreaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    setLoading(true);
    abortRef.current = new AbortController();

    // Build conversation history (only user + assistant messages)
    const history: { role: string; content: string }[] = [];
    setMessages((prev) => {
      // Rebuild from current state (excluding the new ones we just added)
      for (const m of prev) {
        if (m.role === 'user') history.push({ role: 'user', content: m.content });
        else if (m.role === 'assistant' && m.content && !m.isStreaming)
          history.push({ role: 'assistant', content: m.content });
      }
      return prev;
    });
    // Add the current user message
    history.push({ role: 'user', content: text });

    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status}: ${err}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const event = JSON.parse(data);

            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + event.content }
                    : m
                )
              );
            } else if (event.type === 'tool_call') {
              // Add a tool-call indicator message
              const label = TOOL_LABELS[event.name] || event.name;
              const toolMsg: Message = {
                id: generateId(),
                role: 'tool',
                content: `🔧 ${label}...`,
                toolCall: { name: event.name, args: event.args },
              };
              setMessages((prev) => [...prev, toolMsg]);
            } else if (event.type === 'tool_result') {
              // Update the last tool message with result
              const label = TOOL_LABELS[event.name] || event.name;
              setMessages((prev) =>
                prev.map((m) =>
                  m.toolCall?.name === event.name && !m.toolResult
                    ? { ...m, content: `✅ ${label} 完成`, toolResult: event.content }
                    : m
                )
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: event.content, isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // skip parse errors
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `❌ 请求失败: ${(err as Error).message}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, isStreaming: false } : m))
      );
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center
          text-white text-2xl shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
        style={{
          background: open
            ? '#ef4444'
            : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          boxShadow: open
            ? '0 4px 20px rgba(239,68,68,0.4)'
            : '0 4px 20px rgba(59,130,246,0.4)',
        }}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)]
          bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden
          animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0f1729, #1e3a5f)' }}>
            <div>
              <div className="text-white font-semibold text-[14px]">🤖 AI 招商助手</div>
              <div className="text-[11px] text-blue-200/70">DeepSeek · 函数调用</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-blue-200/60 hover:text-white hover:bg-white/10 text-[13px] transition-colors"
                title="清空对话"
              >
                🗑
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🤖</div>
                <div className="text-[14px] font-semibold text-gray-700 mb-1">你好！我是招商助手</div>
                <div className="text-[12px] text-gray-400 leading-relaxed">
                  我可以帮你查看企业信息、匹配政策物业、<br />
                  生成研判报告、新增企业等。试试问我：
                </div>
                <div className="mt-3 flex flex-wrap gap-2 justify-center">
                  {['查看所有企业', '最近有哪些政策', '帮我看看产业图谱'].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => sendMessage(), 0); }}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id}>
                {/* Tool call message */}
                {msg.role === 'tool' && (
                  <div className="flex justify-center my-2">
                    <div
                      className={`text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 ${
                        msg.toolResult
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-blue-50 text-blue-600 border border-blue-200 animate-pulse'
                      }`}
                    >
                      <span>{msg.toolResult ? '✅' : '⏳'}</span>
                      <span>{msg.content}</span>
                    </div>
                  </div>
                )}

                {/* User/Assistant messages */}
                {(msg.role === 'user' || msg.role === 'assistant') && msg.content && (
                  <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">
                        {msg.content}
                        {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse rounded-sm align-middle" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-1.5 border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入消息..."
                disabled={loading}
                className="flex-1 bg-transparent border-none outline-none text-[13px] py-2 text-gray-700 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                  bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed
                  hover:bg-blue-700 transition-colors text-[14px]"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
