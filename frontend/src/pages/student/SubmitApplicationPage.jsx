import { useEffect, useState, useRef, Fragment } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import {
  Send, Users, Search, User, Briefcase, Building2,
  CheckCircle2, AlertCircle, FileText, Paperclip,
  Upload, PenLine, FileUp, X, Eye, ChevronRight,
  Sparkles, Loader2, Check,
} from 'lucide-react';

import {
  submitApplication,
  selectSubmitLoading,
} from '../../store/slices/applicationsSlice';
import { selectAiChatbotEnabled } from '../../store/slices/settingsSlice';
import { setChatbotAppType } from '../../store/slices/uiSlice';
import {
  fetchStaffByDepartment,
  fetchSocietiesByDepartment,
  clearDepartmentRecipients,
  selectDepartmentStaff,
  selectDepartmentSocieties,
  selectStaffLoading,
  selectSocietiesLoading,
} from '../../store/slices/UserSlice';
import { departmentAPI, fileAPI, userAPI, chatbotAPI } from '../../services/api';
import toast from 'react-hot-toast';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href;

const APPLICATION_TYPES = [
  { value: 'result_card_request', label: 'Result Card Request' },
  { value: 'certificate_request', label: 'Certificate Request' },
  { value: 'transcript_request',  label: 'Transcript Request' },
  { value: 'trip_permission',     label: 'Trip Permission' },
  { value: 'fee_concession',      label: 'Fee Concession' },
  { value: 'society_event',       label: 'Society / Club Event' },
  { value: 'other',               label: 'Other' },
];

const RECIPIENT_TABS = [
  { id: 'staff',   label: 'Staff',     icon: Briefcase },
  { id: 'society', label: 'Societies', icon: Users },
];

const ROLE_RECIPIENTS = [
  { value: 'hod',                 label: 'Head of Department (HOD)' },
  { value: 'chairperson',         label: 'Chairperson' },
  { value: 'examination_officer', label: 'Examination Officer' },
  { value: 'vc',                  label: 'Vice Chancellor' },
];

// The ONLY types the Examination Officer handles — either forwarded by HOD or submitted directly.
const EXAMINER_REQUIRED_TYPES = new Set([
  'result_card_request',
  'certificate_request',
  'transcript_request',
]);

const EXAMINER_ALLOWED_LABELS = ['Result Card Request', 'Certificate Request', 'Transcript Request'];

// ── Inline AI suggestion strip ─────────────────────────────────────────────────
function AISuggestion({ suggestion, onUse, onDismiss }) {
  if (!suggestion) return null;
  return (
    <div className="mt-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-600/10 border border-blue-200 dark:border-blue-500/30 animate-fade-in">
      <div className="flex items-start gap-2">
        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-200 leading-relaxed flex-1">{suggestion}</p>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onUse}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          <Check className="w-3 h-3" /> Use this
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/20 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── Input mode pill ────────────────────────────────────────────────────────────
function InputModePill({ mode, setMode }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-obsidian-800/60 rounded-xl border border-gray-200 dark:border-white/5 w-fit">
      {[
        { id: 'write',  icon: PenLine, label: 'Write Application' },
        { id: 'import', icon: FileUp,  label: 'Import File' },
      ].map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setMode(id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === id
              ? 'bg-blue-600 text-white shadow-lg'
              : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── File import zone ───────────────────────────────────────────────────────────
function ImportZone({ importedFile, setImportedFile, setForm, form }) {
  const [dragging, setDragging] = useState(false);
  const [parsing,  setParsing]  = useState(false);
  const [preview,  setPreview]  = useState('');
  const inputRef = useRef(null);

  const parseFile = async (file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'application/msword', 'text/plain'];
    const extOk = /\.(pdf|docx|doc|txt)$/i.test(file.name);
    if (!allowed.includes(file.type) && !extOk) {
      toast.error('Only PDF, DOCX, DOC, and TXT files are supported');
      return;
    }
    setParsing(true);
    setImportedFile(file);
    try {
      let text = '';
      const isPDF  = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isDOCX = /application\/(vnd\.openxmlformats-officedocument\.wordprocessingml\.document|msword)/.test(file.type)
                     || /\.(docx|doc)$/i.test(file.name);
      if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
        text = await file.text();
      } else if (isPDF) {
        text = await extractTextFromPDF(file);
      } else if (isDOCX) {
        text = await extractTextFromDocx(file);
      }
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const guessedTitle = lines[0] || file.name.replace(/\.[^.]+$/, '');
      const body = lines.slice(1).join('\n') || text;
      setPreview(text.slice(0, 500) + (text.length > 500 ? '…' : ''));
      setForm(f => ({ ...f, title: f.title || guessedTitle.slice(0, 120), description: body || text }));
      toast.success('File imported — review and edit before submitting');
    } catch {
      toast.error('Could not parse the file. Try copying text manually.');
    } finally {
      setParsing(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map(item => item.str).join(' '));
    }
    return pageTexts.join('\n').trim() || 'Could not extract text. Please paste manually.';
  };

  const extractTextFromDocx = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim() || 'Could not extract text. Please paste manually.';
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file) parseFile(file); };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !importedFile && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-600/10 scale-[1.01]'
            : importedFile
            ? 'border-emerald-400 dark:border-emerald-500/50 bg-emerald-50 dark:bg-emerald-600/5 cursor-default'
            : 'border-gray-300 dark:border-white/5/60 hover:border-blue-400 dark:hover:border-blue-500/60 hover:bg-blue-50/50 dark:hover:bg-obsidian-800/20'
        }`}
      >
        {parsing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">Parsing file…</p>
          </div>
        ) : importedFile ? (
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-600/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="text-gray-900 dark:text-white text-sm font-medium">{importedFile.name}</p>
                <p className="text-gray-400 dark:text-slate-500 text-xs">{(importedFile.size / 1024).toFixed(1)} KB · Imported</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setImportedFile(null); setPreview(''); setForm(f => ({ ...f, title: '', description: '' })); }}
              className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-slate-300 text-sm font-medium">Drop your application file here</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">or click to browse — PDF, DOCX, DOC, TXT</p>
          </>
        )}
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.txt,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => parseFile(e.target.files[0])} />
      </div>

      {preview && (
        <div className="bg-gray-50 dark:bg-obsidian-850/60 border border-gray-200 dark:border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Extracted Preview</p>
          </div>
          <p className="text-gray-500 dark:text-slate-400 text-xs leading-relaxed font-mono whitespace-pre-wrap">{preview}</p>
        </div>
      )}

      {importedFile && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Review and edit the extracted content before submitting
          </p>
          <div>
            <label className="form-label">Title <span className="text-red-500">*</span></label>
            <input className="input-field" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Application title" required />
          </div>
          <div>
            <label className="form-label">Application Content <span className="text-red-500">*</span></label>
            <textarea className="input-field min-h-[160px] resize-y" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Extracted content — edit as needed…" required />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SubmitApplicationPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();

  const submitLoading    = useSelector(selectSubmitLoading);
  const aiEnabled        = useSelector(selectAiChatbotEnabled);
  const staff            = useSelector(selectDepartmentStaff);
  const societies        = useSelector(selectDepartmentSocieties);
  const staffLoading     = useSelector(selectStaffLoading);
  const societiesLoading = useSelector(selectSocietiesLoading);

  const [step,         setStep]         = useState(1);
  const [inputMode,    setInputMode]    = useState('write');
  const [importedFile, setImportedFile] = useState(null);

  const [form, setForm] = useState({
    title:           '',
    applicationType: 'result_card_request',
    description:     '',
    isUrgent:        false,
  });

  // AI suggestion states
  const [titleSuggestion,    setTitleSuggestion]    = useState('');
  const [descSuggestion,     setDescSuggestion]     = useState('');
  const [loadingTitleSug,    setLoadingTitleSug]    = useState(false);
  const [loadingDescSug,     setLoadingDescSug]     = useState(false);

  const [departments,   setDepartments]   = useState([]);
  const [selectedDept,  setSelectedDept]  = useState('');
  const [recipientMode, setRecipientMode] = useState('role');
  const [recipientRole, setRecipientRole] = useState('');
  const [recipientId,   setRecipientId]   = useState('');
  const [recipientTab,  setRecipientTab]  = useState('staff');

  const [selectedSociety,       setSelectedSociety]       = useState(null);
  const [societyMembers,        setSocietyMembers]        = useState([]);
  const [societyMembersLoading, setSocietyMembersLoading] = useState(false);

  const [search,      setSearch]      = useState('');
  const [attachFile,  setAttachFile]  = useState(null);
  const [success,     setSuccess]     = useState(false);

  useEffect(() => {
    departmentAPI.getAll().then(res => setDepartments(res.data.data)).catch(() => {});
    return () => { dispatch(clearDepartmentRecipients()); dispatch(setChatbotAppType('other')); };
  }, [dispatch]);

  useEffect(() => {
    dispatch(setChatbotAppType(form.applicationType));
  }, [form.applicationType, dispatch]);

  useEffect(() => {
    if (!selectedDept) return;
    dispatch(fetchStaffByDepartment(selectedDept));
    dispatch(fetchSocietiesByDepartment(selectedDept));
    setRecipientId(''); setSelectedSociety(null); setSocietyMembers([]);
  }, [selectedDept, dispatch]);

  const handleSocietyClick = async (society) => {
    setSelectedSociety(society.societyName); setRecipientId(''); setSocietyMembersLoading(true);
    try {
      const res = await userAPI.getSocietyMembers(selectedDept, society.societyName);
      setSocietyMembers(res.data.data);
    } catch { setSocietyMembers([]); } finally { setSocietyMembersLoading(false); }
  };

  const suggestTitle = async () => {
    setLoadingTitleSug(true); setTitleSuggestion('');
    try {
      const res = await chatbotAPI.getSuggestion({ applicationType: form.applicationType, field: 'title' });
      setTitleSuggestion(res.data.data.suggestion);
    } catch { toast.error('Could not generate a suggestion'); } finally { setLoadingTitleSug(false); }
  };

  const suggestDescription = async () => {
    setLoadingDescSug(true); setDescSuggestion('');
    try {
      const res = await chatbotAPI.getSuggestion({
        applicationType: form.applicationType,
        field: 'description',
        context: { title: form.title },
      });
      setDescSuggestion(res.data.data.suggestion);
    } catch { toast.error('Could not generate a suggestion'); } finally { setLoadingDescSug(false); }
  };

  const examinerMismatch =
    recipientMode === 'role' &&
    recipientRole === 'examination_officer' &&
    !EXAMINER_REQUIRED_TYPES.has(form.applicationType);

  const handleContinue = () => {
    if (!form.title.trim() || !form.description.trim() || !form.applicationType) {
      toast.error('Please fill all required fields'); return;
    }
    if (recipientMode === 'role' && !recipientRole) { toast.error('Please select a recipient role'); return; }
    if (recipientMode === 'user' && !recipientId)   { toast.error('Please select a specific recipient'); return; }
    if (examinerMismatch) {
      toast.error('The Examination Officer does not handle this application type'); return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, ...(recipientMode === 'role' ? { recipientRole } : { recipientId }) };
    const result = await dispatch(submitApplication(payload));
    if (submitApplication.fulfilled.match(result)) {
      const appId = result.payload._id;
      const fileToUpload = importedFile || attachFile;
      if (fileToUpload) {
        const formData = new FormData();
        formData.append('files', fileToUpload);
        formData.append('applicationId', appId);
        try { await fileAPI.upload(formData); toast.success('File attached'); }
        catch { toast.error('Application submitted but file upload failed'); }
      }
      setSuccess(true);
      setTimeout(() => navigate('/student/applications'), 2200);
    }
  };

  const filteredStaff = staff.filter(s =>
    `${s.firstName} ${s.lastName} ${s.staffType || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const recipientLabel = recipientMode === 'role'
    ? ROLE_RECIPIENTS.find(r => r.value === recipientRole)?.label || '—'
    : (() => {
        if (recipientTab === 'staff') { const s = staff.find(s => s._id === recipientId); return s ? `${s.firstName} ${s.lastName}` : '—'; }
        const m = societyMembers.find(m => m._id === recipientId);
        return m ? `${m.firstName} ${m.lastName} (${selectedSociety})` : '—';
      })();

  // ── Success screen ──
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-600/20 border border-emerald-300 dark:border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Application Submitted!</h2>
        <p className="text-gray-500 dark:text-slate-400">Redirecting to your applications…</p>
        <div className="w-48 h-1 bg-gray-200 dark:bg-obsidian-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-emerald-500 rounded-full animate-[growWidth_2.2s_ease-in-out_forwards]" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in pb-10">
      <div>
        <h1 className="page-title">Submit Application</h1>
        <p className="text-gray-500 dark:text-slate-400 mt-1">Write or import your application, then choose a recipient</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Details & Recipient' },
          { n: 2, label: 'Attach & Submit' },
        ].map(({ n, label }, i, arr) => (
          <Fragment key={n}>
            <div className={`flex items-center gap-2 ${step >= n ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-600'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all ${
                step > n  ? 'bg-emerald-100 dark:bg-emerald-600/30 border-emerald-400 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
                : step === n ? 'bg-blue-100 dark:bg-blue-600/30 border-blue-400 dark:border-blue-500/50 text-blue-600 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-obsidian-800/60 border-gray-300 dark:border-white/5 text-gray-400 dark:text-slate-600'
              }`}>
                {step > n ? '✓' : n}
              </div>
              <span className="text-sm font-medium hidden sm:block">{label}</span>
            </div>
            {i < arr.length - 1 && (
              <div className={`flex-1 h-px transition-all ${step > n ? 'bg-emerald-400 dark:bg-emerald-600/50' : step === n ? 'bg-blue-300 dark:bg-blue-600/50' : 'bg-gray-200 dark:bg-obsidian-800/30'}`} />
            )}
          </Fragment>
        ))}
      </div>

      <form onSubmit={handleSubmit}>

        {/* ══ STEP 1 ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">

            {/* Application Details */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Application Details</h2>

              <div>
                <p className="form-label mb-2">How do you want to compose this application?</p>
                <InputModePill mode={inputMode} setMode={(m) => { setInputMode(m); setImportedFile(null); setForm(f => ({ ...f, title: '', description: '' })); }} />
              </div>

              {/* Type */}
              <div>
                <label className="form-label">Type <span className="text-red-500">*</span></label>
                <select className="input-field" value={form.applicationType}
                  onChange={e => { setForm(f => ({ ...f, applicationType: e.target.value })); setTitleSuggestion(''); setDescSuggestion(''); }}
                  required
                >
                  {APPLICATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* WRITE MODE */}
              {inputMode === 'write' && (
                <div className="space-y-4 animate-fade-in">

                  {/* Title */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="form-label mb-0">Title <span className="text-red-500">*</span></label>
                      {aiEnabled && (
                        <button
                          type="button"
                          onClick={suggestTitle}
                          disabled={loadingTitleSug}
                          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
                        >
                          {loadingTitleSug
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                          Suggest title
                        </button>
                      )}
                    </div>
                    <input
                      className="input-field"
                      placeholder="Brief title of your application"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      maxLength={120}
                      required
                    />
                    <AISuggestion
                      suggestion={titleSuggestion}
                      onUse={() => { setForm(f => ({ ...f, title: titleSuggestion })); setTitleSuggestion(''); }}
                      onDismiss={() => setTitleSuggestion('')}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="form-label mb-0">Description / Body <span className="text-red-500">*</span></label>
                      {aiEnabled && (
                        <button
                          type="button"
                          onClick={suggestDescription}
                          disabled={loadingDescSug}
                          className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
                        >
                          {loadingDescSug
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Sparkles className="w-3.5 h-3.5" />}
                          Write with AI
                        </button>
                      )}
                    </div>
                    <textarea
                      className="input-field min-h-[140px] resize-y"
                      placeholder={`Write your application content here…\n\nRespectfully,\n[Your Name]`}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      required
                    />
                    <div className="flex items-center justify-between mt-1">
                      <AISuggestion
                        suggestion={descSuggestion}
                        onUse={() => { setForm(f => ({ ...f, description: descSuggestion })); setDescSuggestion(''); }}
                        onDismiss={() => setDescSuggestion('')}
                      />
                      <span className="text-xs text-gray-400 dark:text-slate-600 ml-auto mt-1 flex-shrink-0">
                        {form.description.length} chars
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* IMPORT MODE */}
              {inputMode === 'import' && (
                <div className="animate-fade-in">
                  <ImportZone importedFile={importedFile} setImportedFile={setImportedFile} setForm={setForm} form={form} />
                </div>
              )}

              {/* Urgent toggle */}
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-obsidian-800/40 transition-colors border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/5/50">
                <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${form.isUrgent ? 'bg-red-500' : 'bg-gray-300 dark:bg-obsidian-800/60'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow ${form.isUrgent ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  <input type="checkbox" className="sr-only" checked={form.isUrgent} onChange={e => setForm(f => ({ ...f, isUrgent: e.target.checked }))} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Mark as Urgent</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500">Flags this for priority review</p>
                </div>
              </label>
            </div>

            {/* ── Recipient ── */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Recipient</h2>

              {/* Examiner selected — wrong type warning */}
              {examinerMismatch && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
                    <span className="font-semibold block mb-1">Cannot send this to the Examination Officer</span>
                    The Examination Officer only accepts:
                    <ul className="mt-1 ml-3 space-y-0.5 list-disc">
                      {EXAMINER_ALLOWED_LABELS.map(l => <li key={l}>{l}</li>)}
                    </ul>
                    <span className="block mt-1">Please change the application type or choose a different recipient.</span>
                  </div>
                </div>
              )}

              {/* Examiner selected — correct type info */}
              {!examinerMismatch && recipientMode === 'role' && recipientRole === 'examination_officer' && (
                <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl animate-fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    <span className="font-semibold block mb-0.5">Direct submission to Examination Officer</span>
                    Your selected type is handled directly by the Examination Office. They will verify your academic records and respond.
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {[
                  { id: 'role', icon: Building2, label: 'By Role' },
                  { id: 'user', icon: User,      label: 'Specific Person' },
                ].map(({ id, icon: Icon, label }) => (
                  <button key={id} type="button"
                    onClick={() => { setRecipientMode(id); setRecipientId(''); setRecipientRole(''); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      recipientMode === id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-obsidian-800 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {recipientMode === 'role' && (
                <div className="space-y-2">
                  {ROLE_RECIPIENTS.map(r => {
                    const isExaminer     = r.value === 'examination_officer';
                    const isBlockedCombo = isExaminer && !EXAMINER_REQUIRED_TYPES.has(form.applicationType);
                    const isSelected     = recipientRole === r.value;
                    return (
                      <label key={r.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected && isBlockedCombo
                          ? 'border-red-300 dark:border-red-500/50 bg-red-50 dark:bg-red-500/5 text-red-700 dark:text-red-300'
                          : isSelected
                          ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-600/10 text-gray-900 dark:text-white'
                          : isBlockedCombo
                          ? 'border-gray-200 dark:border-white/5 opacity-60 hover:opacity-80 text-gray-400 dark:text-slate-500'
                          : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 text-gray-500 dark:text-slate-400'
                      }`}>
                        <input type="radio" className="hidden" name="recipientRole" value={r.value}
                          checked={isSelected} onChange={() => setRecipientRole(r.value)} />
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-0.5 ${
                          isSelected && isBlockedCombo ? 'border-red-400 bg-red-400'
                          : isSelected ? 'border-blue-500 bg-blue-500'
                          : 'border-gray-300 dark:border-slate-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{r.label}</p>
                          {isExaminer && (
                            <p className={`text-xs mt-0.5 ${isBlockedCombo ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
                              {isBlockedCombo
                                ? `Does not accept "${APPLICATION_TYPES.find(t => t.value === form.applicationType)?.label}" — accepts: ${EXAMINER_ALLOWED_LABELS.join(', ')}`
                                : `Accepts: ${EXAMINER_ALLOWED_LABELS.join(', ')}`}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {recipientMode === 'user' && (
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Department</label>
                    <select className="input-field" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
                      <option value="">Select department…</option>
                      {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                    </select>
                  </div>

                  {!selectedDept && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Select a department to browse staff and societies
                    </p>
                  )}

                  {selectedDept && (
                    <>
                      <div className="flex gap-1 bg-gray-100 dark:bg-obsidian-800/60 p-1 rounded-lg w-fit">
                        {RECIPIENT_TABS.map(tab => (
                          <button key={tab.id} type="button"
                            onClick={() => { setRecipientTab(tab.id); setRecipientId(''); setSelectedSociety(null); setSearch(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              recipientTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                        <input className="input-field pl-9 py-2 text-sm"
                          placeholder={recipientTab === 'staff' ? 'Search staff…' : 'Search societies…'}
                          value={search} onChange={e => setSearch(e.target.value)} />
                      </div>

                      {recipientTab === 'staff' && (
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {staffLoading ? (
                            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
                          ) : filteredStaff.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No staff found</p>
                          ) : filteredStaff.map(s => (
                            <label key={s._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              recipientId === s._id
                                ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-600/10'
                                : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/5'
                            }`}>
                              <input type="radio" className="hidden" name="recipientId" value={s._id}
                                checked={recipientId === s._id} onChange={() => setRecipientId(s._id)} />
                              <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                                recipientId === s._id ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-slate-600'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white truncate">{s.firstName} {s.lastName}</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">{s.staffType?.replace('_', ' ')}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}

                      {recipientTab === 'society' && !selectedSociety && (
                        <div className="max-h-56 overflow-y-auto space-y-1">
                          {societiesLoading ? (
                            <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
                          ) : societies.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">No societies in this department</p>
                          ) : societies.filter(s => s.societyName.toLowerCase().includes(search.toLowerCase())).map(s => (
                            <button key={s.societyName} type="button" onClick={() => handleSocietyClick(s)}
                              className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-300 dark:hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-600/5 transition-colors text-left">
                              <div className="flex items-center gap-3">
                                <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                                <span className="text-sm text-gray-900 dark:text-white">{s.societyName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                                <span className="text-xs">{s.memberCount} members</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {recipientTab === 'society' && selectedSociety && (
                        <div className="space-y-2">
                          <button type="button" onClick={() => { setSelectedSociety(null); setRecipientId(''); }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">
                            ← Back to societies
                          </button>
                          <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{selectedSociety}</p>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {societyMembersLoading ? (
                              <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin" /></div>
                            ) : societyMembers.map(m => (
                              <label key={m._id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                recipientId === m._id
                                  ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-600/10'
                                  : 'border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/5'
                              }`}>
                                <input type="radio" className="hidden" name="recipientId" value={m._id}
                                  checked={recipientId === m._id} onChange={() => setRecipientId(m._id)} />
                                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                                  recipientId === m._id ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-slate-600'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-900 dark:text-white truncate">{m.firstName} {m.lastName}</p>
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {m.societies?.find(s => s.societyName === selectedSociety)?.position || 'Member'}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <button type="button" onClick={handleContinue} className="btn-primary w-full flex items-center justify-center gap-2">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ══ STEP 2 ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" /> Application Summary
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 dark:text-slate-500 text-xs">Type</p>
                  <p className="text-gray-900 dark:text-white mt-0.5">{APPLICATION_TYPES.find(t => t.value === form.applicationType)?.label}</p>
                </div>
                <div>
                  <p className="text-gray-400 dark:text-slate-500 text-xs">Priority</p>
                  <p className={`mt-0.5 font-medium ${form.isUrgent ? 'text-red-500' : 'text-gray-500 dark:text-slate-400'}`}>
                    {form.isUrgent ? '⚠ Urgent' : 'Normal'}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400 dark:text-slate-500 text-xs">Title</p>
                  <p className="text-gray-900 dark:text-white mt-0.5">{form.title}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400 dark:text-slate-500 text-xs mb-1">Preview</p>
                  <p className="text-gray-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-3">{form.description}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-400 dark:text-slate-500 text-xs">Recipient</p>
                  <p className="text-gray-900 dark:text-white mt-0.5">{recipientLabel}</p>
                </div>
                {inputMode === 'import' && importedFile && (
                  <div className="col-span-2">
                    <p className="text-gray-400 dark:text-slate-500 text-xs">Imported From</p>
                    <p className="text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">{importedFile.name}</p>
                  </div>
                )}
              </div>
            </div>

            {inputMode === 'write' && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                  <Paperclip className="w-4 h-4 text-blue-500" /> Attach Document
                  <span className="text-gray-400 dark:text-slate-600 font-normal normal-case tracking-normal">(Optional)</span>
                </h3>
                <label className="block w-full border-2 border-dashed border-gray-200 dark:border-white/5/60 hover:border-blue-300 dark:hover:border-blue-500/60 rounded-xl p-6 text-center cursor-pointer transition-colors group">
                  <Paperclip className="w-7 h-7 text-gray-300 dark:text-slate-600 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
                  <p className="text-gray-500 dark:text-slate-400 text-sm">{attachFile ? attachFile.name : 'Click to upload or drag & drop'}</p>
                  <p className="text-gray-400 dark:text-slate-600 text-xs mt-1">PDF, DOC, DOCX, JPEG, PNG — Max 10MB</p>
                  <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={e => setAttachFile(e.target.files[0])} />
                </label>
                {attachFile && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-obsidian-850/60 rounded-lg border border-gray-100 dark:border-white/5">
                    <span className="text-gray-700 dark:text-slate-300 text-xs truncate">{attachFile.name}</span>
                    <button type="button" onClick={() => setAttachFile(null)}
                      className="text-gray-400 hover:text-red-500 text-xs ml-2 transition-colors flex-shrink-0">Remove</button>
                  </div>
                )}
              </div>
            )}

            {inputMode === 'import' && importedFile && (
              <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl">
                <Paperclip className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-emerald-700 dark:text-emerald-300 text-xs leading-relaxed">
                  <span className="font-semibold">{importedFile.name}</span> will be attached to this application as a supporting document.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">← Back</button>
              <button type="submit" disabled={submitLoading}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                  : <><Send className="w-4 h-4" /> Submit Application</>}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
