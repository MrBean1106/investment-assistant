import { useEffect, useRef, useState } from 'react';
import { documentsApi, type DocumentItem, type UploadResult } from '../api/documents';

const TYPE_LABEL: Record<string, { label: string; tag: string }> = {
  text: { label: '文本', tag: 'tag-gray' },
  pdf: { label: 'PDF', tag: 'tag-blue' },
  image: { label: '图片', tag: 'tag-orange' },
  unknown: { label: '其他', tag: 'tag-gray' },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function Documents() {
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [active, setActive] = useState<DocumentItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await documentsApi.list();
      setDocs(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadMsg(null);
    let last: UploadResult | null = null;
    try {
      for (const f of Array.from(files)) {
        last = await documentsApi.upload(f);
      }
      if (last) {
        const ocr = last.ocr_used ? `（OCR：${last.ocr_engine || '已识别'}）` : '';
        setUploadMsg(`✅ 已入库：${last.filename} ${ocr}`);
      }
      await load();
    } catch (e) {
      setUploadMsg(`❌ 上传失败：${(e as Error).message}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要从资料库中删除该文件吗？此操作不可恢复。')) return;
    setDeleting(id);
    try {
      await documentsApi.remove(id);
      if (active?.id === id) setActive(null);
      await load();
    } catch (e) {
      alert('删除失败：' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold mb-1">资料库</h1>
          <p className="text-[14px] text-muted">
            {docs ? `${docs.length} 个已解析文件` : '加载中...'}
            <span className="ml-2 text-[12px]">文本 / PDF / 图片（扫描件自动 OCR）</span>
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? '⏳ 解析中…' : '⬆ 上传文件'}
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          multiple
          accept=".txt,.md,.csv,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploadMsg && (
        <div className="card p-3 mb-4 text-[13px] text-ink">{uploadMsg}</div>
      )}

      {loading && <div className="card p-12 text-center text-muted">⏳ 加载中...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.length === 0 && (
            <div className="md:col-span-2 card p-10 text-center text-muted">
              暂无文件，点击右上角「上传文件」添加（支持扫描件 PDF 与图片，自动 OCR 入库）
            </div>
          )}
          {docs.map((d) => {
            const t = TYPE_LABEL[d.file_type] || TYPE_LABEL.unknown;
            return (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-[14px] truncate max-w-[60%]" title={d.filename}>
                    📄 {d.filename}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`tag ${t.tag}`}>{t.label}</span>
                    {d.ocr_used && (
                      <span className="tag tag-green" title={`OCR 引擎：${d.ocr_engine || '未知'}`}>
                        OCR
                      </span>
                    )}
                    <button
                      className="text-[12px] px-1.5 py-0.5 rounded hover:bg-gray-100 text-muted hover:text-accent transition-colors"
                      onClick={() => setActive(d)}
                      title="查看内容"
                    >
                      👁
                    </button>
                    <button
                      className="text-[12px] px-1.5 py-0.5 rounded hover:bg-red-50 text-muted hover:text-red-500 transition-colors"
                      onClick={() => handleDelete(d.id)}
                      disabled={deleting === d.id}
                      title="删除"
                    >
                      {deleting === d.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
                <div className="text-[12px] text-muted flex gap-4 mb-2">
                  <span>📦 {formatSize(d.size)}</span>
                  <span>🕒 {formatDate(d.created_at)}</span>
                </div>
                <div className="text-[13px] text-ink/80 bg-gray-50 rounded-md p-2 max-h-20 overflow-hidden whitespace-pre-wrap">
                  {d.content_preview || '（无文本）'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 内容预览弹窗 */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setActive(null)}>
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="font-semibold text-[15px] truncate">{active.filename}</div>
              <button className="text-muted text-[13px] px-1.5 py-0.5 rounded hover:bg-gray-100" onClick={() => setActive(null)}>✕</button>
            </div>
            <div className="p-5 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap text-ink flex-1">
              {active.content_preview}
              {active.ocr_used && (
                <div className="mt-3 text-[12px] text-muted">🔍 本文件由 OCR（{active.ocr_engine || '未知引擎'}）识别提取。</div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end">
              <button className="btn btn-secondary" onClick={() => handleDelete(active.id)} disabled={deleting === active.id}>
                {deleting === active.id ? '⏳ 删除中' : '🗑️ 删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
