import { useState } from 'react';
import { TOOL_LABELS, summarizeToolResult } from '../utils/aiChat';

export interface ToolEvent {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
  status: 'calling' | 'done' | 'error';
}

export default function ToolCard({ tool }: { tool: ToolEvent }) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[tool.name] || tool.name;
  return (
    <div className="mt-2 rounded-lg border text-[12px] overflow-hidden"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
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
        <div className="px-3 py-2 border-t"
          style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-ink-secondary)' }}>
          {tool.result ? summarizeToolResult(tool.name, tool.result) : '（无返回）'}
        </div>
      )}
      {expanded && tool.result && (
        <pre className="px-3 py-2 text-[11px] overflow-x-auto whitespace-pre-wrap break-all"
          style={{ background: '#0f1729', color: '#cbd5e1', borderTop: '1px solid var(--color-border-light)' }}>
          {(() => { try { return JSON.stringify(JSON.parse(tool.result), null, 2); } catch { return tool.result; } })()}
        </pre>
      )}
    </div>
  );
}
