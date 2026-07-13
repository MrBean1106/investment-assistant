import { API_BASE } from './config';
import type { Attachment } from '../types';

/** 企业过程文件附件接口（基于后端 /api/files） */
export const attachmentsApi = {
  /** 列出某企业的全部附件 */
  list: async (enterpriseId: number): Promise<Attachment[]> => {
    const res = await fetch(`${API_BASE}/files?enterprise_id=${enterpriseId}`);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()) as Attachment[];
  },

  /** 上传附件并关联到企业。note 为可选备注（如：BP、尽调报告） */
  upload: async (enterpriseId: number, file: File, note?: string): Promise<void> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('enterprise_id', String(enterpriseId));
    if (note) fd.append('note', note);
    const res = await fetch(`${API_BASE}/files/upload`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
  },

  /** 删除附件 */
  remove: async (docId: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/files/${docId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },

  /** 下载链接（走 vite 代理 / 生产同源） */
  downloadUrl: (docId: number) => `${API_BASE}/files/${docId}/download`,
};
