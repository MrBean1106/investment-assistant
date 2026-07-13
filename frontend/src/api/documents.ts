import { api } from './client';

export interface DocumentItem {
  id: number;
  filename: string;
  file_type: string;
  ext: string | null;
  ocr_used: boolean;
  ocr_engine: string | null;
  size: number;
  content_preview: string;
  created_at: string | null;
}

export interface UploadResult {
  filename: string;
  file_type: string;
  content: string;
  ocr_used: boolean;
  ocr_engine: string | null;
  document_id: number | null;
  size: number;
}

export const documentsApi = {
  list: () => api.get<DocumentItem[]>('/files'),
  remove: (id: number) => api.del<void>(`/files/${id}`),
  upload: async (file: File): Promise<UploadResult> => {
    const fd = new FormData();
    fd.append('file', file);
    const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
    const res = await fetch(`${BASE}/files/upload`, { method: 'POST', body: fd });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${res.status}: ${err || res.statusText}`);
    }
    return res.json();
  },
};
