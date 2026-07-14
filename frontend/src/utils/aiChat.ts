/**
 * Shared constants and utilities for AI Chat components.
 * Used by both the floating widget (components/AIChat.tsx)
 * and the full-page chat (pages/AIChat.tsx).
 */

// ── Tool name translations ──
export const TOOL_LABELS: Record<string, string> = {
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
  search_industry_chain_nodes: '搜索产业节点',
  create_industry_chain_node: '新增产业节点',
  add_enterprise_to_industry_chain: '关联产业图谱',
};

// ── ID generator ──
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── SSE event types ──
export interface SSETextEvent {
  type: 'text';
  content: string;
}

export interface SSEToolCallEvent {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
}

export interface SSEToolResultEvent {
  type: 'tool_result';
  name: string;
  content: string;
}

export interface SSEErrorEvent {
  type: 'error';
  content: string;
}

export type SSEEvent = SSETextEvent | SSEToolCallEvent | SSEToolResultEvent | SSEErrorEvent;

/**
 * Parse an SSE stream from the AI chat endpoint.
 * Calls the appropriate handler for each event type.
 */
export async function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  handlers: {
    onText?: (content: string) => void;
    onToolCall?: (name: string, args: Record<string, unknown>) => void;
    onToolResult?: (name: string, content: string) => void;
    onError?: (content: string) => void;
  },
): Promise<void> {
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
        const event = JSON.parse(data) as SSEEvent;

        if (event.type === 'text') {
          handlers.onText?.(event.content);
        } else if (event.type === 'tool_call') {
          handlers.onToolCall?.(event.name, event.args);
        } else if (event.type === 'tool_result') {
          handlers.onToolResult?.(event.name, event.content);
        } else if (event.type === 'error') {
          handlers.onError?.(event.content);
        }
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

/**
 * Summarize a tool result for compact display.
 */
export function summarizeToolResult(name: string, raw: string): string {
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
    const keys = Object.keys(obj).slice(0, 4);
    return keys.map((k) => `${k}: ${typeof obj[k] === 'object' ? '…' : obj[k]}`).join('  ·  ');
  }
  return String(data).slice(0, 160);
}
