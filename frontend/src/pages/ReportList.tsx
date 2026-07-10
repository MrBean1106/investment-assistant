import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { API_BASE } from '../api/config';
import { useState } from 'react';

interface ReportItem {
  id: number;
  enterprise_id: number;
  type: string;
  title: string;
  created_at: string | null;
}

interface ReportContent {
  sections: { heading: string; content: string }[];
  conclusion: string;
}

export default function ReportList() {
  const { data: reports, isLoading, error } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get<ReportItem[]>('/reports/'),
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [format, setFormat] = useState<'pdf' | 'docx' | 'txt' | null>(null);

  const buildTxt = (title: string, content: ReportContent) => {
    let text = `${title}\n${'='.repeat(40)}\n\n`;
    if (content.sections) {
      for (const sec of content.sections) {
        text += `${sec.heading}\n${'-'.repeat(20)}\n${sec.content}\n\n`;
      }
    }
    if (content.conclusion) text += `总结：${content.conclusion}\n`;
    text += `\n生成时间：${new Date().toLocaleDateString('zh-CN')}\n`;
    return text;
  };

  const handleDownload = async (reportId: number, title: string, fmt: 'pdf' | 'docx' | 'txt') => {
    setBusy(reportId);
    setFormat(fmt);
    try {
      if (fmt === 'txt') {
        const full = await api.get<{ content: ReportContent }>(`/reports/${reportId}`);
        const blob = new Blob([buildTxt(title, full.content)], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${title}.txt`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const res = await fetch(`${API_BASE}/reports/${reportId}/export?format=${fmt}`);
        if (!res.ok) throw new Error(`导出失败 (${res.status})`);
        const blob = await res.blob();
        // Use server-provided filename when available.
        const disp = res.headers.get('Content-Disposition') || '';
        const m = disp.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
        const fname = m ? decodeURIComponent(m[1]) : `${title}.${fmt}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fname; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert('下载失败: ' + (e as Error).message);
    } finally {
      setBusy(null);
      setFormat(null);
    }
  };

  const isBusy = (id: number, fmt: 'pdf' | 'docx' | 'txt') => busy === id && format === fmt;

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold mb-1">报告中心</h1>
      <p className="text-[14px] text-muted mb-6">招商建议报告 · 投资研判报告 · 支持 PDF / Word 导出</p>

      {isLoading && <div className="card p-12 text-center text-muted">⏳ 加载中...</div>}
      {error && <div className="card p-8 text-center text-red-500">加载失败：{error.message}</div>}

      {reports && reports.length > 0 && (
        <div className="space-y-3 mb-6">
          {reports.map((r) => (
            <div key={r.id} className="card p-4 flex items-center gap-4">
              <span className="text-2xl">📄</span>
              <div className="flex-1">
                <div className="font-semibold text-[14px]">{r.title}</div>
                <div className="text-[12px] text-muted">
                  {r.type} · {r.created_at ? new Date(r.created_at).toLocaleDateString('zh-CN') : ''}
                </div>
              </div>
              <span className={`tag ${r.type === '投资研判' ? 'tag-blue' : 'tag-green'}`}>{r.type}</span>
              <Link to={`/enterprises/${r.enterprise_id}`} className="text-accent text-[13px] hover:underline">查看企业</Link>
              <div className="flex gap-1.5">
                <button
                  className="btn btn-secondary text-[12px]"
                  onClick={() => handleDownload(r.id, r.title, 'pdf')}
                  disabled={busy === r.id}
                >
                  {isBusy(r.id, 'pdf') ? '⏳' : '📄'} PDF
                </button>
                <button
                  className="btn btn-secondary text-[12px]"
                  onClick={() => handleDownload(r.id, r.title, 'docx')}
                  disabled={busy === r.id}
                >
                  {isBusy(r.id, 'docx') ? '⏳' : '📝'} Word
                </button>
                <button
                  className="btn btn-secondary text-[12px]"
                  onClick={() => handleDownload(r.id, r.title, 'txt')}
                  disabled={busy === r.id}
                >
                  {isBusy(r.id, 'txt') ? '⏳' : '📋'} 文本
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {reports && reports.length === 0 && (
        <div className="card p-12 text-center text-muted mb-4">
          <p className="text-4xl mb-2">📄</p>
          <p>暂无报告</p>
          <p className="text-[13px] mt-1">在企业库中选择企业，通过工作流生成招商研判报告</p>
        </div>
      )}
    </div>
  );
}
