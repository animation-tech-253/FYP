import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BookOpen, CheckCircle, Clock, AlertTriangle, FileText,
  Search, RefreshCw, X, Inbox, History,
  Eye, GraduationCap, Building2,
  CheckSquare, Square, Paperclip,
  Download, Trash2, ZoomIn,
} from 'lucide-react';
import {
  fetchExaminerDashboard,
  processApplication,
  bulkProcessApplications,
  selectExaminerData,
  selectExaminerPending,
  selectExaminerAwaitingDocs,
  selectExaminerVerified,
  selectExaminerLoading,
  selectProcessLoading,
} from '../../store/slices/applicationsSlice';
import { departmentAPI } from '../../services/api';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import { APP_TYPE_LABELS, formatDate, formatDistanceToNow } from '../../utils/helpers';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';

const TABS = [
  { id: 'queue',    label: 'Verification Queue', icon: Inbox    },
  { id: 'awaiting', label: 'Awaiting Docs',       icon: Clock    },
  { id: 'verified', label: 'History',              icon: History  },
];

const TYPE_COLORS = {
  result_card_request: '#6366f1',
  certificate_request: '#10b981',
  transcript_request:  '#f59e0b',
  other:               '#8b5cf6',
};

// ── Inline transcript viewer with VERIFIED / APPROVED stamp overlay ───────────
function TranscriptViewer({ attachments, isVerified = false, isApproved = false }) {
  const transcriptFile = attachments?.find(a =>
    a.mimetype === 'application/pdf' ||
    /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(a.originalName || '')
  );
  if (!transcriptFile) return null;

  const isPDF   = transcriptFile.mimetype === 'application/pdf' || /\.pdf$/i.test(transcriptFile.originalName || '');
  const viewUrl = `${API_BASE}/files/${transcriptFile._id}/view`;

  const handleSaveWithStamp = (e) => {
    e.stopPropagation();
    const stampHtml = isApproved
      ? `<div class="stamp approved">APPROVED</div>`
      : isVerified
      ? `<div class="stamp verified">VERIFIED</div>`
      : '';

    const win = window.open('', '_blank', 'width=960,height=800');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${transcriptFile.originalName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #fff; }
    .container { position: relative; display: inline-block; width: 100%; }
    img { display: block; width: 100%; height: auto; }
    .stamp {
      position: absolute;
      font-family: serif;
      font-weight: 900;
      color: #10b981;
      border-color: #10b981;
      border-style: solid;
      letter-spacing: 0.18em;
      pointer-events: none;
    }
    .stamp.approved {
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      border-width: 4px;
      font-size: 32px;
      padding: 12px 24px;
      opacity: 0.35;
    }
    .stamp.verified {
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      border-width: 3px;
      font-size: 30px;
      letter-spacing: 0.2em;
      padding: 8px 24px;
      opacity: 0.35;
    }
    @media print { body { margin: 0; } .container { width: 100%; } }
  </style>
</head>
<body>
  <div class="container">
    <img src="${viewUrl}" alt="Transcript" crossorigin="use-credentials" />
    ${stampHtml}
  </div>
  <script>
    document.querySelector('img').onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
    document.querySelector('img').onerror = function() { window.print(); };
  </script>
</body>
</html>`);
    win.document.close();
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const res  = await fetch(viewUrl, { credentials: 'include' });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = transcriptFile.originalName || 'transcript';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(viewUrl, '_blank');
    }
  };

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/5/60 bg-gray-50 dark:bg-obsidian-850/40 mb-4">

      {/* APPROVED stamp — centered watermark */}
      {isApproved && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="border-[4px] border-emerald-500 text-emerald-500 font-black tracking-widest px-6 py-3 select-none"
            style={{ transform: 'rotate(-30deg)', fontSize: '32px', fontFamily: 'serif', letterSpacing: '0.2em', opacity: 0.35 }}
          >
            APPROVED
          </div>
        </div>
      )}

      {/* VERIFIED stamp — centered watermark */}
      {isVerified && !isApproved && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className="border-[3px] border-emerald-500 text-emerald-500 font-black tracking-widest px-6 py-2 select-none"
            style={{ transform: 'rotate(-30deg)', fontSize: '30px', fontFamily: 'serif', letterSpacing: '0.2em', opacity: 0.35 }}
          >
            VERIFIED
          </div>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 dark:border-white/5/60 bg-white dark:bg-obsidian-800/60">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[200px]">{transcriptFile.originalName}</span>
        </div>
        <div className="flex items-center gap-3">
          {(isVerified || isApproved) && (
            <button
              onClick={handleSaveWithStamp}
              className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Save with Stamp
            </button>
          )}
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Original
          </button>
        </div>
      </div>

      {isPDF ? (
        <iframe
          src={viewUrl}
          title="Transcript Preview"
          className="w-full"
          style={{ height: '520px', border: 'none' }}
        />
      ) : (
        <img
          src={viewUrl}
          alt="Transcript"
          className="w-full max-h-[520px] object-contain"
        />
      )}
    </div>
  );
}

function VerifyModal({ app, onClose, dispatch, processLoading }) {
  const [form, setForm] = useState({ cgpa: '', attendanceMet: false, remarks: '' });

  const cgpaNum   = parseFloat(form.cgpa);
  const cgpaValid = form.cgpa.trim() !== '' && !isNaN(cgpaNum) && cgpaNum >= 0;
  const cgpaFails = cgpaValid && cgpaNum < 2.8;
  const canVerify = cgpaValid && form.attendanceMet;

  const handleVerify = async () => {
    if (!cgpaValid) { toast.error('Please enter the CGPA shown on the transcript'); return; }
    if (!form.attendanceMet) { toast.error('Please confirm the attendance requirement is met'); return; }
    await dispatch(processApplication({
      id: app._id,
      data: {
        action: 'verified',
        verificationData: {
          cgpa:          cgpaNum,
          attendanceMet: form.attendanceMet,
          isEligible:    cgpaNum >= 2.8 && form.attendanceMet,
          remarks:       form.remarks,
        },
      },
    }));
    onClose();
  };

  const handleReject = async () => {
    if (!form.remarks.trim()) { toast.error('Please provide a reason for rejection'); return; }
    await dispatch(processApplication({ id: app._id, data: { action: 'rejected', remarks: form.remarks } }));
    onClose();
  };

  const handleRequestDocs = async () => {
    if (!form.remarks.trim()) { toast.error('Please describe what documents are needed'); return; }
    await dispatch(processApplication({ id: app._id, data: { action: 'request_docs', remarks: form.remarks } }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card p-6 w-full max-w-2xl animate-slide-up max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Transcript Verification</h3>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 font-mono">{app.applicationId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Student info */}
        <div className="bg-gray-50 dark:bg-obsidian-850/50 rounded-xl p-4 mb-4 border border-gray-100 dark:border-white/5/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-xs font-bold text-blue-500">
              {app.student?.firstName?.[0]}{app.student?.lastName?.[0]}
            </div>
            <div>
              <p className="text-gray-900 dark:text-white text-sm font-medium">{app.student?.firstName} {app.student?.lastName}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs">{app.student?.studentId} · {app.department?.name}</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-slate-200 text-sm font-medium">{app.title}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">{APP_TYPE_LABELS?.[app.applicationType] || app.applicationType}</p>
        </div>

        {/* Inline transcript viewer */}
        {app.attachments?.length > 0 && (
          <TranscriptViewer attachments={app.attachments} isVerified={false} />
        )}

        {/* Fallback attachment list for non-transcript files */}
        <AttachmentsPanel attachments={app.attachments} />

        {app.documentRequests?.length > 0 && (
          <div className="mb-4 space-y-2 mt-4">
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Document Request History</p>
            {app.documentRequests.map((req, i) => (
              <div key={i} className={`p-3 rounded-xl border text-xs ${req.isResolved ? 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5' : 'border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={req.isResolved ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                    {req.isResolved ? '✓ Resolved' : '⏳ Awaiting student'}
                  </span>
                  <span className="text-gray-400 dark:text-slate-500">{req.requestedAt ? formatDate(req.requestedAt) : ''}</span>
                </div>
                <p className="text-gray-600 dark:text-slate-300">{req.message}</p>
              </div>
            ))}
          </div>
        )}

        {app.description && (
          <div className="bg-gray-50 dark:bg-obsidian-850/50 rounded-xl p-4 mb-4 border border-gray-100 dark:border-white/5/60">
            <p className="text-gray-400 dark:text-slate-500 text-xs mb-1">Application Description</p>
            <p className="text-gray-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{app.description}</p>
          </div>
        )}

        {/* ── Eligibility fields ── */}
        <div className="space-y-3 my-4">
          {/* CGPA */}
          <div>
            <label className="label">CGPA on Transcript <span className="text-red-400">*</span></label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="4"
              value={form.cgpa}
              onChange={e => setForm(p => ({ ...p, cgpa: e.target.value }))}
              className={`input-field ${cgpaFails ? 'border-red-400 dark:border-red-500/60 focus:ring-red-500/30' : ''}`}
              placeholder="e.g. 3.90  — read from the Semester Report row"
            />
            {cgpaFails && (
              <p className="flex items-center gap-1.5 text-red-500 dark:text-red-400 text-xs mt-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                CGPA {cgpaNum.toFixed(2)} is below the minimum requirement of 2.8 — this application will be marked <strong>ineligible</strong>. Consider rejecting instead.
              </p>
            )}
            {cgpaValid && !cgpaFails && (
              <p className="flex items-center gap-1.5 text-emerald-500 text-xs mt-1.5">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" /> CGPA meets the minimum requirement (≥ 2.8)
              </p>
            )}
          </div>

          {/* Attendance checkbox */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/5/60 hover:bg-gray-50 dark:hover:bg-obsidian-800/50 transition-colors">
            <input
              type="checkbox"
              checked={form.attendanceMet}
              onChange={e => setForm(p => ({ ...p, attendanceMet: e.target.checked }))}
              className="mt-0.5 accent-emerald-500 w-4 h-4 flex-shrink-0"
            />
            <div>
              <p className="text-gray-900 dark:text-white text-sm font-medium">All subjects meet attendance requirement (≥ 75%) <span className="text-red-400">*</span></p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">Check the <em>Attend. %</em> column in the transcript above — tick only if every subject meets the threshold</p>
            </div>
          </label>

          {/* Remarks */}
          <div>
            <label className="label">Remarks <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></label>
            <textarea
              value={form.remarks}
              onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))}
              className="input-field resize-none"
              rows={2}
              placeholder="Flag a discrepancy, note an exception, or describe required documents…"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleRequestDocs} disabled={processLoading} className="flex-1 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/35 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-sm font-medium transition-all disabled:opacity-50">Request Docs</button>
          <button onClick={handleReject}      disabled={processLoading} className="flex-1 py-2.5 rounded-xl border border-red-300 dark:border-red-500/35 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-sm font-medium transition-all disabled:opacity-50">Reject</button>
          <button
            onClick={handleVerify}
            disabled={processLoading || !canVerify}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            title={!canVerify ? 'Enter CGPA and confirm attendance to verify' : ''}
          >
            {processLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Verify</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── View-only modal for History tab (shows VERIFIED stamp) ────────────────────
function VerifiedViewModal({ app, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card p-6 w-full max-w-2xl animate-slide-up max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold">Verified Transcript</h3>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 font-mono">{app.applicationId}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-obsidian-850/50 rounded-xl p-4 mb-4 border border-gray-100 dark:border-white/5/60 text-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-xs font-bold text-emerald-500">
              {app.student?.firstName?.[0]}{app.student?.lastName?.[0]}
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-medium">{app.student?.firstName} {app.student?.lastName}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs">{app.student?.studentId} · {app.department?.name}</p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-slate-200 font-medium">{app.title}</p>
          <div className="flex flex-wrap gap-3 mt-3">
            {app.academicVerification?.cgpa != null && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 dark:text-slate-500">CGPA:</span>
                <span className={`font-mono font-semibold ${app.academicVerification.cgpa >= 2.8 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {app.academicVerification.cgpa.toFixed(2)}
                </span>
                {app.academicVerification.cgpa < 2.8 && <span className="text-red-400">(below 2.8)</span>}
              </div>
            )}
            {app.academicVerification?.attendanceMet != null && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-400 dark:text-slate-500">Attendance:</span>
                <span className={app.academicVerification.attendanceMet ? 'text-emerald-500' : 'text-red-400'}>
                  {app.academicVerification.attendanceMet ? '✓ Met' : '✗ Not met'}
                </span>
              </div>
            )}
            {app.academicVerification?.isEligible != null && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                app.academicVerification.isEligible
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                  : 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25'
              }`}>
                {app.academicVerification.isEligible ? 'Eligible' : 'Ineligible'}
              </span>
            )}
          </div>
          {app.academicVerification?.remarks && (
            <p className="text-gray-500 dark:text-slate-400 text-xs mt-2 italic">
              Examiner notes: "{app.academicVerification.remarks}"
            </p>
          )}
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">
            Verified on {app.academicVerification?.verifiedAt ? formatDate(app.academicVerification.verifiedAt) : '—'}
          </p>
        </div>

        {/* Transcript with VERIFIED / APPROVED stamp */}
        {app.attachments?.length > 0 && (
          <TranscriptViewer
            attachments={app.attachments}
            isVerified={true}
            isApproved={app.status === 'approved' || app.status === 'completed'}
          />
        )}
      </div>
    </div>
  );
}

function BulkActionBar({ selectedIds, allIds, onSelectAll, onClearAll, onBulkReject, onBulkVerify }) {
  const allSelected = selectedIds.length === allIds.length && allIds.length > 0;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/25 animate-fade-in">
      <button onClick={allSelected ? onClearAll : onSelectAll} className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors font-medium">
        {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        {allSelected ? 'Deselect All' : `Select All (${allIds.length})`}
      </button>
      <span className="text-gray-400 dark:text-slate-500 text-xs">{selectedIds.length} selected</span>
      <div className="flex-1" />
      <button onClick={onBulkVerify} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-xs font-medium transition-all">
        <CheckCircle className="w-3.5 h-3.5" /> Verify Selected
      </button>
      <button onClick={onBulkReject} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/25 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/25 text-xs font-medium transition-all">
        <Trash2 className="w-3.5 h-3.5" /> Reject Selected
      </button>
      <button onClick={onClearAll} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function BulkModal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card p-6 w-full max-w-md animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-gray-900 dark:text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppCard({ app, onVerify, selected, onSelect }) {
  const hasPending = app.documentRequests?.some(r => !r.isResolved);
  return (
    <div
      className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-sm animate-fade-in ${
        app.isUrgent ? 'border-red-200 dark:border-red-500/25 bg-red-50/30 dark:bg-red-500/5' :
        selected     ? 'border-blue-300 dark:border-blue-500/35 bg-blue-50/30 dark:bg-blue-500/5' :
                       'border-gray-200 dark:border-white/5/60 bg-white dark:bg-obsidian-800/40 hover:border-gray-300 dark:hover:border-white/5/60'
      }`}
      onClick={() => onSelect(app._id)}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={e => { e.stopPropagation(); onSelect(app._id); }}
          className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-slate-500 hover:text-blue-500 transition-colors"
        >
          {selected ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
        </button>

        <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[app.applicationType] || '#6b7280' }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-blue-500">{app.applicationId}</span>
                {app.isUrgent  && <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5 font-medium">URGENT</span>}
                {hasPending    && <span className="text-[10px] bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 rounded-full px-2 py-0.5">Docs Requested</span>}
                {app.attachments?.length > 0 && (
                  <span className="text-[10px] bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25 rounded-full px-2 py-0.5 flex items-center gap-1">
                    <Paperclip className="w-2.5 h-2.5" />{app.attachments.length}
                  </span>
                )}
              </div>
              <p className="text-gray-900 dark:text-white text-sm font-semibold mt-0.5 truncate">{app.title}</p>
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0 whitespace-nowrap">{formatDistanceToNow(app.submittedDate)} ago</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              {app.student?.firstName} {app.student?.lastName}{app.student?.studentId ? ` (${app.student.studentId})` : ''}
            </span>
            {app.department?.name && (
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{app.department.name}</span>
            )}
          </div>

          {app.description && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">
              {app.description}
            </p>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">{APP_TYPE_LABELS?.[app.applicationType] || app.applicationType}</span>
            <button
              onClick={e => { e.stopPropagation(); onVerify(app); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25 rounded-lg text-xs font-medium transition-all"
            >
              <Eye className="w-3 h-3" /> Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportVerifiedCSV(verified) {
  const escape = val => `"${String(val || '').replace(/"/g, '""')}"`;
  const headers = [
    'Application ID', 'Application Type', 'Student Name', 'Student ID',
    'Department', 'Submitted Date', 'CGPA', 'Attendance Met (≥75%)',
    'Eligible (CGPA≥2.8)', 'Verified Date', 'Final Status', 'Examiner Remarks',
  ];
  const rows = verified.map(app => {
    const v    = app.academicVerification || {};
    const cgpa = v.cgpa != null ? parseFloat(v.cgpa) : null;
    return [
      app.applicationId                  || '',
      escape(app.applicationType         || ''),
      escape(`${app.student?.firstName || ''} ${app.student?.lastName || ''}`.trim()),
      app.student?.studentId             || '',
      escape(app.department?.name        || ''),
      app.submittedDate ? new Date(app.submittedDate).toLocaleDateString() : '',
      cgpa != null ? cgpa.toFixed(2)     : '',
      v.attendanceMet == null ? '' : v.attendanceMet ? 'Yes' : 'No',
      v.isEligible    == null ? '' : v.isEligible    ? 'Yes' : 'No',
      v.verifiedAt ? new Date(v.verifiedAt).toLocaleDateString() : '',
      app.status                         || '',
      escape(v.remarks                   || ''),
    ].join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href:     url,
    download: `verified_transcripts_${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExaminerDashboard() {
  const dispatch       = useDispatch();
  const examinerData   = useSelector(selectExaminerData);
  const pending        = useSelector(selectExaminerPending);
  const awaitingDocs   = useSelector(selectExaminerAwaitingDocs);
  const verified       = useSelector(selectExaminerVerified);
  const loading        = useSelector(selectExaminerLoading);
  const processLoading = useSelector(selectProcessLoading);

  const [activeTab,      setActiveTab]      = useState('queue');
  const [selectedApp,    setSelectedApp]    = useState(null);
  const [selectedIds,    setSelectedIds]    = useState([]);
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkVerifyOpen, setBulkVerifyOpen] = useState(false);
  const [search,         setSearch]         = useState('');
  const [deptFilter,     setDeptFilter]     = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');
  const [urgentOnly,     setUrgentOnly]     = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departments,    setDepartments]    = useState([]);
  const [bulkRejectReason,  setBulkRejectReason]  = useState('');
  const [bulkVerifyForm,    setBulkVerifyForm]    = useState({ remarks: '', confirmed: false });
  const [viewingVerified,   setViewingVerified]   = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = {};
    if (debouncedSearch) params.search         = debouncedSearch;
    if (deptFilter)      params.department      = deptFilter;
    if (typeFilter)      params.applicationType = typeFilter;
    if (urgentOnly)      params.isUrgent        = 'true';
    dispatch(fetchExaminerDashboard(params));
    setSelectedIds([]);
  }, [debouncedSearch, deptFilter, typeFilter, urgentOnly, dispatch]);

  useEffect(() => {
    departmentAPI.getAll().then(r => setDepartments(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { setSelectedIds([]); }, [activeTab]);

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const selectAll = useCallback(() => setSelectedIds(pending.map(a => a._id)), [pending]);
  const clearAll  = useCallback(() => setSelectedIds([]), []);

  const hasFilters = search || deptFilter || typeFilter || urgentOnly;

  const handleBulkReject = async () => {
    if (!bulkRejectReason.trim()) { toast.error('Please provide a rejection reason'); return; }
    await dispatch(bulkProcessApplications({ applicationIds: selectedIds, action: 'rejected', remarks: bulkRejectReason.trim() }));
    setBulkRejectOpen(false); setBulkRejectReason(''); clearAll();
  };

  const handleBulkVerify = async () => {
    if (!bulkVerifyForm.confirmed) { toast.error('Please confirm eligibility criteria before bulk verifying'); return; }
    await dispatch(bulkProcessApplications({
      applicationIds: selectedIds,
      action: 'verified',
      verificationData: {
        attendanceMet: true,
        isEligible:    true,
        remarks:       bulkVerifyForm.remarks || 'Bulk verified',
      },
    }));
    setBulkVerifyOpen(false); setBulkVerifyForm({ remarks: '', confirmed: false }); clearAll();
  };

  const handleRefresh = () => {
    const params = {};
    if (debouncedSearch) params.search         = debouncedSearch;
    if (deptFilter)      params.department      = deptFilter;
    if (typeFilter)      params.applicationType = typeFilter;
    if (urgentOnly)      params.isUrgent        = 'true';
    dispatch(fetchExaminerDashboard(params));
  };

  const tabCounts = {
    queue:    examinerData.pendingCount,
    awaiting: examinerData.awaitingDocCount,
    verified: examinerData.totalVerifiedCount,
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Examination Office"
        subtitle="Academic verification queue and history"
        icon={BookOpen}
        iconColor="text-orange-500"
        actions={
          <button onClick={handleRefresh} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
        <StatCard label="Pending Verification" value={examinerData.pendingCount}       icon={Inbox}         colorClass="bg-amber-500/15 text-amber-500"   urgent={examinerData.urgentCount > 0} sub={examinerData.urgentCount > 0 ? `${examinerData.urgentCount} urgent` : null} />
        <StatCard label="Awaiting Documents"   value={examinerData.awaitingDocCount}   icon={Clock}         colorClass="bg-purple-500/15 text-purple-500" />
        <StatCard label="Total Verified"       value={examinerData.totalVerifiedCount} icon={CheckCircle}   colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Urgent Cases"         value={examinerData.urgentCount}        icon={AlertTriangle} colorClass="bg-red-500/15 text-red-500"         urgent={examinerData.urgentCount > 0} />
      </div>

      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-obsidian-850/60 rounded-xl border border-gray-200 dark:border-white/5/60 w-fit animate-fade-in">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/25'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-obsidian-800/50'
            }`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              activeTab === tab.id ? 'bg-orange-500/20 text-orange-600 dark:text-orange-300' : 'bg-gray-200 dark:bg-obsidian-800/50 text-gray-400 dark:text-slate-500'
            }`}>
              {tabCounts[tab.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 animate-slide-up">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search student name, ID or application…" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"><X className="w-4 h-4" /></button>}
        </div>
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="input-field w-full sm:w-48">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input-field w-full sm:w-44">
          <option value="">All Types</option>
          <option value="result_card_request">Result Card</option>
          <option value="certificate_request">Certificate</option>
          <option value="transcript_request">Transcript</option>
          <option value="other">Other</option>
        </select>
        <button
          onClick={() => setUrgentOnly(v => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
            urgentOnly
              ? 'bg-red-50 dark:bg-red-500/15 border-red-300 dark:border-red-500/35 text-red-600 dark:text-red-400'
              : 'bg-white dark:bg-obsidian-800/40 border-gray-200 dark:border-white/5/60 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/5'
          }`}
        >
          <AlertTriangle className="w-4 h-4" /> {urgentOnly ? 'Urgent Only' : 'All'}
        </button>
        {hasFilters && (
          <button onClick={() => { setSearch(''); setDeptFilter(''); setTypeFilter(''); setUrgentOnly(false); }} className="btn-secondary text-sm flex items-center gap-2">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-orange-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {activeTab === 'queue' && (
            <div className="space-y-3 animate-fade-in">
              {pending.length === 0 ? (
                <div className="card p-12 text-center">
                  <Inbox className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">{hasFilters ? 'No applications match your filters' : 'Verification queue is clear'}</p>
                  {!hasFilters && <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Applications appear here when the HOD forwards them for transcript verification</p>}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 dark:text-slate-500 text-sm">{pending.length} application{pending.length !== 1 ? 's' : ''} pending{hasFilters ? ' (filtered)' : ''}</p>
                    <button onClick={() => setSelectedIds(prev => prev.length === pending.length ? [] : pending.map(a => a._id))} className="text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                      {selectedIds.length === pending.length ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {selectedIds.length === pending.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  {selectedIds.length > 0 && <BulkActionBar selectedIds={selectedIds} allIds={pending.map(a => a._id)} onSelectAll={selectAll} onClearAll={clearAll} onBulkReject={() => setBulkRejectOpen(true)} onBulkVerify={() => setBulkVerifyOpen(true)} />}
                  {pending.filter(a => a.isUrgent).map(app  => <AppCard key={app._id} app={app} onVerify={setSelectedApp} selected={selectedIds.includes(app._id)} onSelect={toggleSelect} />)}
                  {pending.filter(a => !a.isUrgent).map(app => <AppCard key={app._id} app={app} onVerify={setSelectedApp} selected={selectedIds.includes(app._id)} onSelect={toggleSelect} />)}
                </>
              )}
            </div>
          )}

          {activeTab === 'awaiting' && (
            <div className="space-y-3 animate-fade-in">
              {awaitingDocs.length === 0 ? (
                <div className="card p-12 text-center">
                  <Clock className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 font-medium">{hasFilters ? 'No applications match your filters' : 'No applications awaiting documents'}</p>
                </div>
              ) : awaitingDocs.map(app => {
                const pendingReqs = app.documentRequests?.filter(r => !r.isResolved) || [];
                const latestReq   = pendingReqs[pendingReqs.length - 1];
                const allResolved = pendingReqs.length === 0;
                return (
                  <div key={app._id} className={`card p-4 animate-fade-in ${allResolved ? 'border-emerald-200 dark:border-emerald-500/20' : 'border-amber-200 dark:border-amber-500/20'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs text-blue-500">{app.applicationId}</span>
                          {allResolved
                            ? <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 rounded-full px-2 py-0.5">Docs Submitted — Ready to Verify</span>
                            : <span className="text-[10px] bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 rounded-full px-2 py-0.5">Awaiting Student Upload</span>}
                          {app.isUrgent && <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5 font-medium">URGENT</span>}
                        </div>
                        <p className="text-gray-900 dark:text-white text-sm font-semibold">{app.title}</p>
                        <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
                          {app.student?.firstName} {app.student?.lastName}{app.student?.studentId ? ` (${app.student.studentId})` : ''} · {app.department?.name}
                        </p>
                        {latestReq && (
                          <div className="mt-2 p-2.5 bg-gray-50 dark:bg-obsidian-850/50 rounded-lg border border-gray-100 dark:border-white/5/60">
                            <p className="text-gray-400 dark:text-slate-500 text-xs mb-1">Documents requested:</p>
                            <p className="text-amber-600 dark:text-amber-400 text-xs">{latestReq.message}</p>
                          </div>
                        )}
                        {app.attachments?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-gray-400 dark:text-slate-500 text-xs mb-1.5 flex items-center gap-1">
                              <Paperclip className="w-3 h-3" /> {app.attachments.length} attachment{app.attachments.length !== 1 ? 's' : ''}
                            </p>
                            <AttachmentsPanel attachments={app.attachments} />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="text-gray-400 dark:text-slate-500 text-xs">{formatDate(app.submittedDate)}</span>
                        {allResolved && (
                          <button onClick={() => { setSelectedApp(app); setActiveTab('queue'); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 rounded-lg text-xs font-medium transition-all">
                            <Eye className="w-3 h-3" /> Verify Now
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'verified' && (
            <div className="space-y-4 animate-fade-in">
              {verified.length > 0 && (
                <div className="flex justify-end">
                  <button onClick={() => exportVerifiedCSV(verified)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/25 text-sm font-medium transition-all">
                    <Download className="w-4 h-4" /> Export CSV
                  </button>
                </div>
              )}
              <div className="card overflow-hidden">
                {verified.length === 0 ? (
                  <div className="p-12 text-center">
                    <History className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-slate-400 font-medium">{hasFilters ? 'No verified applications match your filters' : 'No verified applications yet'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-obsidian-850/60 border-b border-gray-100 dark:border-white/5/60">
                          {['ID', 'Student', 'Department', 'CGPA', 'Attend.', 'Eligible', 'Examiner Remarks', 'Verified At', 'Status', ''].map(h => (
                            <th key={h} className="table-header-cell">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {verified.map((app, idx) => {
                          const v = app.academicVerification;
                          return (
                            <tr key={app._id} className="table-row animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                              <td className="table-cell"><span className="font-mono text-xs text-blue-500">{app.applicationId}</span></td>
                              <td className="table-cell text-xs">
                                <p className="font-medium">{app.student?.firstName} {app.student?.lastName}</p>
                                {app.student?.studentId && <span className="text-gray-400 dark:text-slate-500 font-mono">{app.student.studentId}</span>}
                              </td>
                              <td className="table-cell text-xs text-gray-500 dark:text-slate-400">{app.department?.name || '—'}</td>
                              <td className="table-cell text-xs font-mono font-semibold">
                                {v?.cgpa != null
                                  ? <span className={v.cgpa >= 2.8 ? 'text-emerald-500' : 'text-red-400'}>{v.cgpa.toFixed(2)}</span>
                                  : <span className="text-gray-400 dark:text-slate-500">—</span>}
                              </td>
                              <td className="table-cell text-xs">
                                {v?.attendanceMet == null ? <span className="text-gray-400 dark:text-slate-500">—</span>
                                  : v.attendanceMet
                                  ? <span className="text-emerald-500">✓ Yes</span>
                                  : <span className="text-red-400">✗ No</span>}
                              </td>
                              <td className="table-cell text-xs">
                                {v?.isEligible == null ? <span className="text-gray-400 dark:text-slate-500">—</span>
                                  : v.isEligible
                                  ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">Eligible</span>
                                  : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/25">Ineligible</span>}
                              </td>
                              <td className="table-cell text-xs text-gray-500 dark:text-slate-400 max-w-[140px]">
                                <p className="truncate italic">{v?.remarks || '—'}</p>
                              </td>
                              <td className="table-cell text-xs text-gray-400 dark:text-slate-500">{v?.verifiedAt ? formatDate(v.verifiedAt) : '—'}</td>
                              <td className="table-cell"><StatusBadge status={app.status} /></td>
                              <td className="table-cell">
                                {app.attachments?.length > 0 && (
                                  <button
                                    onClick={() => setViewingVerified(app)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 text-xs font-medium transition-all"
                                    title="View verified transcript"
                                  >
                                    <ZoomIn className="w-3 h-3" /> View
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {selectedApp && (
        <VerifyModal app={selectedApp} onClose={() => setSelectedApp(null)} dispatch={dispatch} processLoading={processLoading} />
      )}

      {bulkRejectOpen && (
        <BulkModal title={`Bulk Reject · ${selectedIds.length} selected`} onClose={() => { setBulkRejectOpen(false); setBulkRejectReason(''); }}>
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-3 mb-5 text-xs text-red-600 dark:text-red-400">
            This will reject all {selectedIds.length} selected applications with the same reason. This cannot be undone.
          </div>
          <div className="mb-5">
            <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea value={bulkRejectReason} onChange={e => setBulkRejectReason(e.target.value)} className="input-field resize-none" rows={4} placeholder="e.g. Incomplete documentation, dues not cleared…" autoFocus />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setBulkRejectOpen(false); setBulkRejectReason(''); }} className="flex-1 btn-secondary text-sm">Cancel</button>
            <button onClick={handleBulkReject} disabled={processLoading || !bulkRejectReason.trim()} className="flex-1 btn-danger text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {processLoading ? <div className="w-4 h-4 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Reject All</>}
            </button>
          </div>
        </BulkModal>
      )}

      {bulkVerifyOpen && (
        <BulkModal title={`Bulk Verify · ${selectedIds.length} selected`} onClose={() => { setBulkVerifyOpen(false); setBulkVerifyForm({ remarks: '' }); }}>
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 mb-5 text-xs text-blue-600 dark:text-blue-400">
            All {selectedIds.length} selected applications will be marked as transcript-verified and returned to their HODs for final approval.
          </div>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 dark:border-white/5/60 hover:bg-gray-50 dark:hover:bg-obsidian-800/50 transition-colors mb-4">
            <input
              type="checkbox"
              checked={bulkVerifyForm.confirmed}
              onChange={e => setBulkVerifyForm(p => ({ ...p, confirmed: e.target.checked }))}
              className="mt-0.5 accent-emerald-500 w-4 h-4 flex-shrink-0"
            />
            <div>
              <p className="text-gray-900 dark:text-white text-sm font-medium">I confirm all selected applications meet eligibility criteria</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">CGPA ≥ 2.8 and all subjects have ≥ 75% attendance</p>
            </div>
          </label>
          <div className="mb-4">
            <label className="label">Remarks <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span></label>
            <textarea value={bulkVerifyForm.remarks} onChange={e => setBulkVerifyForm(p => ({ ...p, remarks: e.target.value }))} className="input-field resize-none" rows={2} placeholder="Optional batch verification notes…" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setBulkVerifyOpen(false)} className="flex-1 btn-secondary text-sm">Cancel</button>
            <button onClick={handleBulkVerify} disabled={processLoading || !bulkVerifyForm.confirmed} className="flex-1 btn-success text-sm flex items-center justify-center gap-2 disabled:opacity-40">
              {processLoading ? <div className="w-4 h-4 border-2 border-emerald-300/30 border-t-emerald-500 rounded-full animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Verify All</>}
            </button>
          </div>
        </BulkModal>
      )}

      {viewingVerified && (
        <VerifiedViewModal app={viewingVerified} onClose={() => setViewingVerified(null)} />
      )}
    </div>
  );
}
