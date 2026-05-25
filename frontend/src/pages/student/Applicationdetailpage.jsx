import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, Download, Printer, FileText, Clock,
  CheckCircle, XCircle, ArrowRight, AlertTriangle,
  User, Building2, Hash, Calendar, Shield,
  Paperclip, Upload, Send, CheckCircle2, X, Loader2,
} from 'lucide-react';
import { applicationAPI, fileAPI } from '../../services/api';
import { selectUser } from '../../store/slices/authSlice';
import { resolveDocumentRequest } from '../../store/slices/applicationsSlice';
import { formatDate } from '../../utils/helpers';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';

// ── Inline transcript viewer with stamp overlay ───────────────────────────────
function TranscriptViewer({ attachments, isVerified = false, isApproved = false }) {
  const transcriptFile = attachments?.find(a =>
    a.mimetype === 'application/pdf' ||
    /\.(pdf|jpg|jpeg|png|gif|webp)$/i.test(a.originalName || '')
  );
  if (!transcriptFile) return null;

  const isPDF   = transcriptFile.mimetype === 'application/pdf' || /\.pdf$/i.test(transcriptFile.originalName || '');
  const viewUrl = `${API_BASE}/files/${transcriptFile._id}/view`;

  const handleSaveWithStamp = () => {
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
    document.querySelector('img').onerror = function() {
      window.print();
    };
  </script>
</body>
</html>`);
    win.document.close();
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(viewUrl, { credentials: 'include' });
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
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/5/60 bg-gray-50 dark:bg-obsidian-850/40">

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
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300 truncate max-w-[220px]">{transcriptFile.originalName}</span>
        </div>
        <div className="flex items-center gap-3">
          {(isVerified || isApproved) && (
            <button
              onClick={handleSaveWithStamp}
              className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
            >
              <Printer className="w-3.5 h-3.5" /> Save with Stamp
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
          title="Transcript"
          className="w-full"
          style={{ height: '540px', border: 'none' }}
        />
      ) : (
        <img src={viewUrl} alt="Transcript" className="w-full max-h-[540px] object-contain" />
      )}
    </div>
  );
}

const APP_TYPE_LABELS = {
  result_card_request: 'Result Card Request',
  trip_permission:     'Trip Permission',
  certificate_request: 'Certificate Request',
  other:               'Other Application',
};

const STATUS_META = {
  pending:      { label: 'Pending Review', color: '#d97706',  bg: '#fef3c7', icon: Clock },
  under_review: { label: 'Under Review',   color: '#2563eb',  bg: '#dbeafe', icon: FileText },
  approved:     { label: 'Approved',       color: '#059669',  bg: '#d1fae5', icon: CheckCircle },
  rejected:     { label: 'Rejected',       color: '#dc2626',  bg: '#fee2e2', icon: XCircle },
  forwarded:    { label: 'Forwarded',      color: '#7c3aed',  bg: '#ede9fe', icon: ArrowRight },
  completed:    { label: 'Completed',      color: '#475569',  bg: '#f1f5f9', icon: CheckCircle },
};

// ── Document Request Section ──────────────────────────────────────────────────
function DocRequestSection({ app, onRefresh }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const [pendingFiles,  setPendingFiles]  = useState([]);
  const [uploading,     setUploading]     = useState(false);
  const [resolving,     setResolving]     = useState(false);

  const unresolvedReqs = app.documentRequests?.filter(r => !r.isResolved) || [];
  if (!unresolvedReqs.length) return null;

  const handleFilePick = (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length) setPendingFiles(prev => [...prev, ...picked]);
    e.target.value = '';
  };

  const removeFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUploadAll = async () => {
    if (!pendingFiles.length) return;
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append('files', file);
        fd.append('applicationId', app._id);
        await fileAPI.upload(fd);
      }
      toast.success(`${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''} uploaded`);
      setPendingFiles([]);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleNotifyExaminer = async () => {
    setResolving(true);
    try {
      await dispatch(resolveDocumentRequest(app._id));
      onRefresh();
    } finally {
      setResolving(false);
    }
  };

  const hasUploadedFiles = app.attachments?.length > 0;

  return (
    <div className="no-print rounded-2xl border-2 border-orange-500/40 bg-orange-500/5 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-orange-500/10 border-b border-orange-500/20">
        <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Paperclip className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <p className="text-orange-300 font-semibold text-sm">Action Required — Documents Requested</p>
          <p className="text-orange-400/70 text-xs mt-0.5">The Examination Office needs additional documents before your application can be processed</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* What's needed */}
        <div className="space-y-2">
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">Documents Requested</p>
          {unresolvedReqs.map((req, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
              <span className="text-orange-400 font-bold text-xs mt-0.5 flex-shrink-0">#{i + 1}</span>
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm leading-relaxed">{req.message}</p>
                {req.requestedAt && (
                  <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">Requested {formatDate(req.requestedAt)}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Already uploaded */}
        {hasUploadedFiles && (
          <div>
            <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">
              Already Uploaded ({app.attachments.length} file{app.attachments.length !== 1 ? 's' : ''})
            </p>
            <AttachmentsPanel attachments={app.attachments} />
          </div>
        )}

        {/* Upload new files */}
        <div>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide mb-2">Upload Files</p>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-orange-500/30 hover:border-orange-500/60 bg-orange-500/5 hover:bg-orange-500/10 cursor-pointer transition-all"
          >
            <Upload className="w-6 h-6 text-orange-400/60" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">Click to select files</p>
            <p className="text-gray-400 dark:text-slate-600 text-xs">PDF, Word, JPG, PNG accepted</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            onChange={handleFilePick}
            className="hidden"
          />

          {pendingFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-obsidian-800/60 border border-gray-200 dark:border-white/5">
                  <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-xs text-gray-700 dark:text-slate-300 truncate flex-1">{f.name}</span>
                  <span className="text-xs text-gray-400 dark:text-slate-600 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => removeFile(i)} className="text-gray-400 dark:text-slate-500 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={handleUploadAll}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 border border-blue-500/30 text-sm font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                  : <><Upload className="w-4 h-4" /> Upload {pendingFiles.length} File{pendingFiles.length > 1 ? 's' : ''}</>}
              </button>
            </div>
          )}
        </div>

        {/* Submit / Notify */}
        <div className="pt-2 border-t border-orange-500/20">
          <p className="text-gray-400 dark:text-slate-500 text-xs mb-3">
            Once you have uploaded all required documents above, click the button below to notify the Examination Office that your documents are ready for review.
          </p>
          <button
            onClick={handleNotifyExaminer}
            disabled={resolving || pendingFiles.length > 0}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {resolving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Notifying Examiner…</>
              : <><Send className="w-4 h-4" /> Submit Documents &amp; Notify Examiner</>}
          </button>
          {pendingFiles.length > 0 && (
            <p className="text-orange-400/70 text-xs text-center mt-2">Upload the selected files first before notifying</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── The formal "paper" view — rendered in both screen and print ───────────────
function ApplicationPaper({ app, history }) {
  const status = STATUS_META[app.status] || STATUS_META.pending;
  const StatusIcon = status.icon;
  const today = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div
      id="application-paper"
      className="bg-white text-gray-900"
      style={{
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '20mm 18mm',
        fontFamily: '"Georgia", "Times New Roman", serif',
        fontSize: '11pt',
        lineHeight: '1.7',
        boxShadow: '0 4px 40px rgba(0,0,0,0.18)',
        position: 'relative',
      }}
    >
      {/* Letterhead */}
      <div style={{ borderBottom: '3px double #1a1a2e', paddingBottom: '10mm', marginBottom: '8mm' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '20pt', fontWeight: 'bold', color: '#1a1a2e', margin: 0, letterSpacing: '0.5px' }}>
              SUATS
            </p>
            <p style={{ fontSize: '9pt', color: '#475569', margin: '2px 0 0', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Smart University Application &amp; Tracking System
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '9pt', color: '#64748b', margin: 0 }}>Application No.</p>
            <p style={{ fontSize: '13pt', fontWeight: 'bold', color: '#1a1a2e', margin: '2px 0 0', fontFamily: '"Courier New", monospace' }}>
              {app.applicationId}
            </p>
            <p style={{ fontSize: '9pt', color: '#64748b', marginTop: '4px' }}>
              Date: {formatDate(app.submittedDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Application Type Badge */}
      <div style={{ marginBottom: '8mm' }}>
        <span style={{
          display: 'inline-block',
          border: '1px solid #1a1a2e',
          padding: '2px 10px',
          fontSize: '9pt',
          fontWeight: 'bold',
          letterSpacing: '1px',
          textTransform: 'uppercase',
          color: '#1a1a2e',
        }}>
          {APP_TYPE_LABELS[app.applicationType] || app.applicationType}
        </span>
        {app.isUrgent && (
          <span style={{
            marginLeft: '8px',
            display: 'inline-block',
            border: '1px solid #dc2626',
            padding: '2px 10px',
            fontSize: '9pt',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: '#dc2626',
          }}>
            ⚠ URGENT
          </span>
        )}
      </div>

      {/* Subject / Title */}
      <div style={{ marginBottom: '8mm' }}>
        <p style={{ fontSize: '9pt', color: '#64748b', marginBottom: '3px', fontStyle: 'italic' }}>Subject:</p>
        <p style={{ fontSize: '14pt', fontWeight: 'bold', color: '#0f172a', margin: 0, borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
          {app.title}
        </p>
      </div>

      {/* Parties Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm', marginBottom: '8mm' }}>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '5mm' }}>
          <p style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3mm' }}>
            From (Applicant)
          </p>
          <p style={{ fontWeight: 'bold', margin: '0 0 1mm', color: '#0f172a' }}>
            {app.student?.firstName} {app.student?.lastName}
          </p>
          {app.student?.studentId && (
            <p style={{ margin: '0 0 1mm', fontSize: '10pt', color: '#475569' }}>
              Student ID: {app.student.studentId}
            </p>
          )}
          <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>
            {app.student?.email}
          </p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', padding: '5mm' }}>
          <p style={{ fontSize: '8pt', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '3mm' }}>
            To (Recipient)
          </p>
          <p style={{ fontWeight: 'bold', margin: '0 0 1mm', color: '#0f172a' }}>
            {app.currentRecipient
              ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}`
              : '—'}
          </p>
          <p style={{ margin: '0 0 1mm', fontSize: '10pt', color: '#475569', textTransform: 'capitalize' }}>
            {app.currentRecipient?.role?.replace(/_/g, ' ')}
          </p>
          <p style={{ margin: 0, fontSize: '10pt', color: '#475569' }}>
            {app.department?.name || '—'}
          </p>
        </div>
      </div>

      {/* Salutation */}
      <p style={{ marginBottom: '4mm' }}>
        Respected Sir/Ma'am,
      </p>

      {/* Body */}
      <div style={{ marginBottom: '8mm', textAlign: 'justify' }}>
        <p style={{ marginBottom: '3mm', fontWeight: 'bold', borderLeft: '3px solid #1a1a2e', paddingLeft: '4mm', color: '#0f172a' }}>
          Application Details:
        </p>
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '4px',
          padding: '5mm',
          whiteSpace: 'pre-wrap',
          fontSize: '11pt',
          lineHeight: '1.8',
          color: '#1e293b',
        }}>
          {app.description}
        </div>
      </div>

      {/* Remarks if any */}
      {app.finalRemarks && (
        <div style={{ marginBottom: '8mm', padding: '4mm', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 2mm', color: '#92400e', fontSize: '9pt', textTransform: 'uppercase' }}>
            Official Remarks:
          </p>
          <p style={{ margin: 0, color: '#78350f', fontStyle: 'italic' }}>{app.finalRemarks}</p>
        </div>
      )}

      {/* Academic Verification */}
      {app.academicVerification?.isVerified && (
        <div style={{ marginBottom: '8mm', padding: '4mm', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '4px' }}>
          <p style={{ fontWeight: 'bold', margin: '0 0 2mm', color: '#14532d', fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ✓ Academic Verification (Examination Department)
          </p>
          {app.academicVerification.cgpa != null && (
            <p style={{ margin: '0 0 1mm', color: '#166534' }}>CGPA on Record: <strong>{app.academicVerification.cgpa}</strong></p>
          )}
          {app.academicVerification.remarks && (
            <p style={{ margin: 0, color: '#166534', fontStyle: 'italic' }}>{app.academicVerification.remarks}</p>
          )}
        </div>
      )}

      {/* Closing */}
      <p style={{ marginBottom: '12mm' }}>
        Thanking you in anticipation.
      </p>

      {/* Signature block */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10mm' }}>
        <div>
          <div style={{ borderTop: '1px solid #374151', paddingTop: '3mm', minWidth: '50mm' }}>
            <p style={{ margin: 0, fontSize: '10pt', color: '#374151', fontWeight: 'bold' }}>
              {app.student?.firstName} {app.student?.lastName}
            </p>
            <p style={{ margin: 0, fontSize: '9pt', color: '#64748b' }}>Applicant Signature</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ borderTop: '1px solid #374151', paddingTop: '3mm', minWidth: '50mm' }}>
            <p style={{ margin: 0, fontSize: '10pt', color: '#374151', fontWeight: 'bold' }}>
              {app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '________________'}
            </p>
            <p style={{ margin: 0, fontSize: '9pt', color: '#64748b' }}>Authorized Signature &amp; Stamp</p>
          </div>
        </div>
      </div>

      {/* Status Stamp */}
      <div style={{
        position: 'absolute',
        top: '55mm',
        right: '15mm',
        transform: 'rotate(-15deg)',
        border: `4px solid ${status.color}`,
        borderRadius: '4px',
        padding: '3mm 6mm',
        opacity: 0.2,
        pointerEvents: 'none',
      }}>
        <p style={{ margin: 0, fontSize: '22pt', fontWeight: 'bold', color: status.color, letterSpacing: '2px', textTransform: 'uppercase' }}>
          {status.label}
        </p>
      </div>

      {/* Processing History */}
      {history && history.length > 0 && (
        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '6mm', marginTop: '4mm' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '4mm', fontSize: '10pt', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569' }}>
            Processing History
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                {['Date & Time', 'Action', 'By', 'Remarks'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '2mm 3mm', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '8pt' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h._id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '2mm 3mm', color: '#475569', whiteSpace: 'nowrap' }}>
                    {new Date(h.timestamp || h.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '2mm 3mm', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e293b', fontSize: '8pt' }}>
                    {h.action}
                  </td>
                  <td style={{ padding: '2mm 3mm', color: '#475569' }}>
                    {h.actionBy ? `${h.actionBy.firstName} ${h.actionBy.lastName}` : '—'}
                  </td>
                  <td style={{ padding: '2mm 3mm', color: '#64748b', fontStyle: 'italic' }}>
                    {h.remarks || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{ position: 'absolute', bottom: '10mm', left: '18mm', right: '18mm', borderTop: '1px solid #e2e8f0', paddingTop: '3mm', display: 'flex', justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8' }}>Generated by SUATS — Smart University Application &amp; Tracking System</p>
        <p style={{ margin: 0, fontSize: '8pt', color: '#94a3b8' }}>Printed: {today}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApplicationDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [app,        setApp]        = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [downloading, setDownloading] = useState(false);

  const fetchApp = async () => {
    setLoading(true);
    try {
      const res = await applicationAPI.getById(id);
      setApp(res.data.data);
      setHistory(res.data.data?.history || []);
    } catch {
      toast.error('Application not found');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApp(); }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const res = await applicationAPI.getPDF(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href     = url;
      a.download = `Application_${app?.applicationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!app) return null;

  const status = STATUS_META[app.status] || STATUS_META.pending;
  const StatusIcon = status.icon;

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #application-paper, #application-paper * { visibility: visible !important; }
          #application-paper {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
        @keyframes growWidth { from { width: 0% } to { width: 100% } }
      `}</style>

      <div className="space-y-6 pb-10 animate-fade-in">

        {/* ── Header bar (no-print) ── */}
        <div className="no-print flex items-center justify-between flex-wrap gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-sm font-medium group"
          >
            <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-obsidian-800/60 border border-gray-200 dark:border-white/5 flex items-center justify-center group-hover:border-blue-500/50 group-hover:bg-blue-600/10 transition-all">
              <ArrowLeft className="w-4 h-4" />
            </div>
            Back
          </button>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold"
              style={{ color: status.color, borderColor: status.color + '60', background: status.color + '15' }}>
              <StatusIcon className="w-3.5 h-3.5" />
              {status.label}
            </span>

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-obsidian-800 border border-gray-200 dark:border-white/5/50 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:text-white text-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> Print
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors disabled:opacity-60"
            >
              {downloading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Download className="w-4 h-4" />}
              Export PDF
            </button>
          </div>
        </div>

        {/* ── Quick metadata strip (no-print) ── */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Hash,      label: 'App ID',    value: app.applicationId, mono: true },
            { icon: Calendar,  label: 'Submitted', value: formatDate(app.submittedDate) },
            { icon: Building2, label: 'Department',value: app.department?.name || '—' },
            { icon: Shield,    label: 'Recipient', value: app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—' },
          ].map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5 text-blue-400" />
                <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
              </div>
              <p className={`text-sm font-semibold text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Document request section (shown only when examiner requests docs) ── */}
        <DocRequestSection app={app} onRefresh={fetchApp} />

        {/* ── Attachments (no-print) ── */}
        {app.attachments?.length > 0 && !app.documentRequests?.some(r => !r.isResolved) && (
          <div className="no-print">
            {['result_card_request', 'certificate_request', 'transcript_request'].includes(app.applicationType) ? (
              <TranscriptViewer
                attachments={app.attachments}
                isVerified={!!app.academicVerification?.isVerified}
                isApproved={app.status === 'approved' || app.status === 'completed'}
              />
            ) : (
              <AttachmentsPanel attachments={app.attachments} />
            )}
          </div>
        )}

        {/* ── The paper itself ── */}
        <div className="overflow-x-auto">
          <ApplicationPaper app={app} history={history} />
        </div>

        {/* ── Urgency warning (no-print) ── */}
        {app.isUrgent && (
          <div className="no-print flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">This application is marked as <strong>URGENT</strong> and requires priority attention.</p>
          </div>
        )}
      </div>
    </>
  );
}