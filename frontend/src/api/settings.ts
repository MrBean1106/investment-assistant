import { API_BASE } from './config';

export interface LlmSettings {
  configured: boolean;
  source: string; // 'env' | 'db' | 'none'
  base_url: string;
  model: string;
  masked_key: string;
}

export interface LlmSavePayload {
  api_key?: string | null; // null = 不修改；'' = 清除；非空 = 设置
  base_url?: string;
  model?: string;
  clear_key?: boolean;
}

export const settingsApi = {
  /** 读取当前大模型配置（api_key 以脱敏形式返回） */
  getLlm: async (): Promise<LlmSettings> => {
    const res = await fetch(`${API_BASE}/settings/llm`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 保存大模型配置 */
  saveLlm: async (payload: LlmSavePayload): Promise<LlmSettings & { ok: boolean; note?: string }> => {
    const res = await fetch(`${API_BASE}/settings/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** 测试连接 */
  testLlm: async (payload: LlmSavePayload): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/settings/llm/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.detail || j.message || JSON.stringify(j));
    return j;
  },
};
