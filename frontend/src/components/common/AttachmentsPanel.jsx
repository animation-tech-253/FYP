import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { FileText, Eye, Download, X, Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';

const isPDF = (file) =>
  file?.mimetype === 'application/pdf' || /\.pdf$/i.test(file?.originalName || '');

// ── In-page PDF renderer ──────────────────────────────────────────────────────
function PDFViewer({ file, onClose }) {
  const [pages,    setPages]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const viewUrl = `${API_BASE}/files/${file._id}/view`;
        const pdf = await pdfjsLib.getDocument({ url: viewUrl, withCredentials: true }).promise;
        if (cancelled) return;

        setNumPages(pdf.numPages);
        const rendered = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) break;
          const page     = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas   = document.createElement('canvas');
          canvas.width   = viewport.width;
          canvas.height  = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          rendered.push(canvas.toDataURL());
        }

        if (!cancelled) { setPages(rendered); setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message || 'Failed to render PDF'); setLoading(false); }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [file._id]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-obsidian-850 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-slate-100 text-sm font-medium truncate">{file.originalName}</span>
          {numPages > 0 && (
            <span className="text-slate-500 text-xs flex-shrink-0 hidden sm:inline">
              {numPages} page{numPages !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={`${API_BASE}/files/${file._id}/view?download=1`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/35 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-obsidian-800/60/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* PDF canvas pages */}
      <div className="flex-1 overflow-y-auto bg-slate-900 p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-slate-400 text-sm">Rendering PDF…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FileText className="w-10 h-10 text-red-400" />
            <p className="text-red-400 text-sm text-center max-w-sm">{error}</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {pages.map((dataUrl, i) => (
              <div key={i}>
                <p className="text-slate-600 text-xs text-center mb-2">
                  Page {i + 1} of {numPages}
                </p>
                <img
                  src={dataUrl}
                  alt={`Page ${i + 1}`}
                  className="w-full rounded-lg shadow-xl shadow-black/60"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Attachments list with view + download ─────────────────────────────────────
export default function AttachmentsPanel({ attachments }) {
  const [previewFile, setPreviewFile] = useState(null);

  if (!attachments?.length) return null;

  return (
    <>
      <div className="bg-slate-50 dark:bg-obsidian-850/60 rounded-xl p-4 space-y-1.5 border border-slate-200 dark:border-white/5">
        <p className="text-slate-500 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
          Attachments ({attachments.length})
        </p>
        {attachments.map(file => {
          const pdf = isPDF(file);
          return (
            <div
              key={file._id}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
                {file.originalName}
              </span>
              {file.size > 0 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-600 flex-shrink-0">
                  {(file.size / 1024).toFixed(0)} KB
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                {pdf && (
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    title="View PDF"
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </button>
                )}
                <a
                  href={`${API_BASE}/files/${file._id}/view?download=1`}
                  title="Download"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdf ? '' : 'Download'}
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {previewFile && (
        <PDFViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}
