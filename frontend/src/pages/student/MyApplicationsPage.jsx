import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Download, Eye, ArrowRight, Paperclip } from 'lucide-react';
import {
  fetchMyApplications,
  selectMyApplications,
  selectApplicationsLoading,
} from '../../store/slices/applicationsSlice';
import { applicationAPI } from '../../services/api';
import { APP_TYPE_LABELS, formatDate, formatDistanceToNow } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  pending:      { label: 'Pending',      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  under_review: { label: 'Under Review', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  approved:     { label: 'Approved',     cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  forwarded:    { label: 'Forwarded',    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed:    { label: 'Completed',    cls: 'bg-slate-500/10 text-gray-500 dark:text-slate-400 border-slate-500/20' },
};

// ── PDF download (stops row click propagation) ────────────────────────────────
const downloadPDF = async (e, id, appId) => {
  e.stopPropagation();
  try {
    const res = await applicationAPI.getPDF(id);
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `Application_${appId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PDF downloaded');
  } catch {
    toast.error('Failed to download PDF');
  }
};

// ── Application row ───────────────────────────────────────────────────────────
function AppRow({ app }) {
  const navigate = useNavigate();
  const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;

  return (
    <div
      className="border-b border-gray-100 dark:border-white/5 last:border-0 group cursor-pointer hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors"
      onClick={() => navigate(`/student/applications/${app._id}`)}
      title="Click to view full application"
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600/30 transition-colors">
          <FileText className="w-4 h-4 text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{app.title}</p>
            {app.isUrgent && (
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1">URGENT</span>
            )}
            {(app.hasPendingDocRequest || app.documentRequests?.some(r => !r.isResolved)) && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded px-1.5 py-0.5 flex items-center gap-1 font-medium animate-pulse">
                <Paperclip className="w-2.5 h-2.5" /> Docs Required
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            <span className="font-mono text-blue-400/70">{app.applicationId}</span>
            {' · '}
            {APP_TYPE_LABELS?.[app.applicationType] || app.applicationType?.replace(/_/g, ' ')}
            {' · '}
            {formatDistanceToNow(app.createdAt)}
          </p>
          {app.currentRecipient && (
            <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">
              With: {app.currentRecipient.firstName} {app.currentRecipient.lastName}
              {app.currentRecipient.role && ` (${app.currentRecipient.role.replace(/_/g, ' ')})`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {/* View detail */}
          <Link
            to={`/student/applications/${app._id}`}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-all px-2 py-1 rounded-lg hover:bg-blue-500/10"
            title="View full application"
          >
            <Eye className="w-3.5 h-3.5" /> View
          </Link>

          {/* PDF download */}
          <button
            onClick={(e) => downloadPDF(e, app._id, app.applicationId)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Arrow hint */}
        <ArrowRight className="w-4 h-4 text-gray-400 dark:text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyApplicationsPage() {
  const dispatch     = useDispatch();
  const applications = useSelector(selectMyApplications);
  const loading      = useSelector(selectApplicationsLoading);

  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => { dispatch(fetchMyApplications()); }, [dispatch]);

  const filtered = applications.filter(a => {
    const matchSearch = !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      a.applicationId?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Count per status for filter tabs
  const counts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = applications.filter(a => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">My Applications</h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">{applications.length} total · click any row to view</p>
        </div>
        <Link to="/student/submit" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 text-sm"
            placeholder="Search by title or ID…"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="input-field pl-9 w-full sm:w-48 text-sm"
          >
            <option value="all">All Status ({applications.length})</option>
            {Object.entries(STATUS_CONFIG).map(([val, { label }]) => (
              <option key={val} value={val}>{label} ({counts[val] || 0})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status summary pills */}
      {applications.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_CONFIG).filter(([k]) => counts[k] > 0).map(([val, { label, cls }]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(filterStatus === val ? 'all' : val)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                filterStatus === val ? cls + ' ring-1 ring-current' : 'bg-gray-100 dark:bg-obsidian-800/40 text-gray-400 dark:text-slate-500 border-gray-200 dark:border-white/5 hover:text-gray-600 dark:text-slate-300'
              }`}
            >
              {label} · {counts[val]}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400">
              {applications.length === 0 ? 'No applications yet' : 'No applications match your filters'}
            </p>
            {applications.length === 0 && (
              <Link to="/student/submit" className="btn-primary inline-flex items-center gap-2 text-sm mt-4">
                <Plus className="w-4 h-4" /> Submit your first application
              </Link>
            )}
          </div>
        ) : (
          filtered.map(app => <AppRow key={app._id} app={app} />)
        )}
      </div>
    </div>
  );
}