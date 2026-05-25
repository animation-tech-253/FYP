import { useEffect, useState, useCallback } from 'react';
import {
  Search, Loader2, Inbox, Eye, FileText,
  ChevronDown, ChevronUp, XCircle, RefreshCw,
} from 'lucide-react';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const apiFetch = async (path, options = {}) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';
  const res  = await fetch(`${base}${path}`, { credentials: 'include', ...options });
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
};

const AppDetailModal = ({ appId, onClose }) => {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appId) return;
    setLoading(true);
    apiFetch(`/applications/department/${appId}`)
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load application'))
      .finally(() => setLoading(false));
  }, [appId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card w-full max-w-2xl max-h-[88vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5/60">
          <h3 className="text-gray-900 dark:text-white font-semibold">Application Detail</h3>
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            </div>
          ) : !data ? (
            <p className="text-gray-400 dark:text-slate-500 text-center py-8">Failed to load</p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-blue-500 mb-1">{data.applicationId}</p>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{data.title}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={data.status} />
                    {data.isUrgent && (
                      <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5">URGENT</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-obsidian-850/50 rounded-xl p-4">
                {[
                  { label: 'Student', value: `${data.student?.firstName} ${data.student?.lastName}`, sub: data.student?.studentId },
                  { label: 'Current Recipient', value: `${data.currentRecipient?.firstName || ''} ${data.currentRecipient?.lastName || ''}`, sub: data.currentRecipient?.role?.replace(/_/g, ' ') },
                  { label: 'Type', value: APP_TYPE_LABELS?.[data.applicationType] || data.applicationType },
                  { label: 'Submitted', value: formatDate(data.submittedDate) },
                ].map(({ label, value, sub }) => (
                  <div key={label}>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mb-0.5">{label}</p>
                    <p className="text-gray-700 dark:text-slate-200 font-medium text-sm">{value}</p>
                    {sub && <p className="text-gray-400 dark:text-slate-500 text-xs capitalize">{sub}</p>}
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-gray-400 dark:text-slate-500 text-xs mb-0.5">Description</p>
                  <p className="text-gray-600 dark:text-slate-300 leading-relaxed">{data.description}</p>
                </div>
                {data.finalRemarks && (
                  <div className="col-span-2">
                    <p className="text-gray-400 dark:text-slate-500 text-xs mb-0.5">Final Remarks</p>
                    <p className="text-gray-600 dark:text-slate-300 italic">"{data.finalRemarks}"</p>
                  </div>
                )}
              </div>

              <AttachmentsPanel attachments={data.attachments} />

              {data.history?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Activity Timeline</p>
                  <div className="space-y-3">
                    {data.history.map((h, i) => (
                      <div key={h._id || i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${
                            h.action === 'approved' || h.action === 'verified' ? 'bg-emerald-400' :
                            h.action === 'rejected' ? 'bg-red-400' :
                            h.action === 'forwarded' ? 'bg-blue-400' : 'bg-slate-400'
                          }`} />
                          {i < data.history.length - 1 && <div className="w-px flex-1 bg-gray-200 dark:bg-obsidian-800/40 mt-1" />}
                        </div>
                        <div className="pb-3 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-900 dark:text-white capitalize font-medium">{h.action?.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">by {h.actionBy?.firstName} {h.actionBy?.lastName}</p>
                          </div>
                          {h.remarks && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 italic">"{h.remarks}"</p>}
                          <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">{formatDate(h.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AppCard = ({ app, onView }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* ── Collapsed header ── */}
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{app.title}</p>
            {app.isUrgent && (
              <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5 font-medium">URGENT</span>
            )}
            <StatusBadge status={app.status} />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
            {app.student?.firstName} {app.student?.lastName}
            {app.student?.studentId ? ` · ${app.student.studentId}` : ''}
            {app.department?.name ? ` · ${app.department.name}` : ''}
            {' · '}{formatDate(app.submittedDate)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onView(app._id); }}
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="View full detail"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-4 border-t border-gray-100 dark:border-white/5 space-y-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Application ID</p>
              <p className="text-gray-700 dark:text-slate-200 font-mono">{app.applicationId}</p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Type</p>
              <p className="text-gray-700 dark:text-slate-200">{APP_TYPE_LABELS?.[app.applicationType] || app.applicationType}</p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Student ID</p>
              <p className="text-gray-700 dark:text-slate-200 font-mono">{app.student?.studentId || '—'}</p>
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Submitted</p>
              <p className="text-gray-700 dark:text-slate-200">{formatDate(app.submittedDate)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Student</p>
              <p className="text-gray-700 dark:text-slate-200 font-medium">{app.student?.firstName} {app.student?.lastName}</p>
              {app.student?.email && <p className="text-gray-400 dark:text-slate-500">{app.student.email}</p>}
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Currently With</p>
              <p className="text-gray-700 dark:text-slate-200">
                {app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—'}
              </p>
              {app.currentRecipient?.role && (
                <p className="text-gray-400 dark:text-slate-500 capitalize">{app.currentRecipient.role.replace(/_/g, ' ')}</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Priority</p>
              <p className={app.isUrgent ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-slate-400'}>
                {app.isUrgent ? 'Urgent' : 'Normal'}
              </p>
            </div>
          </div>

          {/* Description */}
          {app.description && (
            <div className="text-xs">
              <p className="text-gray-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">Description</p>
              <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{app.description}</p>
            </div>
          )}

          {/* Final remarks */}
          {app.finalRemarks && (
            <div className="bg-gray-50 dark:bg-obsidian-800/60 rounded-lg p-3 border border-gray-100 dark:border-white/5 text-xs">
              <p className="text-gray-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Final Remarks</p>
              <p className="text-gray-700 dark:text-slate-300 italic">"{app.finalRemarks}"</p>
            </div>
          )}

          {/* Attachments */}
          {app.attachments?.length > 0 && <AttachmentsPanel attachments={app.attachments} />}

          {/* Status footer */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-white/5">
            <span>Status: <span className="font-medium text-gray-700 dark:text-slate-300 capitalize">{app.status?.replace(/_/g, ' ')}</span></span>
            {app.currentRecipient && (
              <span>Currently with: <span className="font-medium text-gray-700 dark:text-slate-300">
                {app.currentRecipient.firstName} {app.currentRecipient.lastName}
                {app.currentRecipient.role ? ` (${app.currentRecipient.role.replace(/_/g, ' ')})` : ''}
              </span></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function HODApplicationsPage() {
  const [applications,  setApplications]  = useState([]);
  const [pagination,    setPagination]    = useState({ page: 1, pages: 1, total: 0 });
  const [appLoading,    setAppLoading]    = useState(true);
  const [filters, setFilters] = useState({
    status: '', applicationType: '', assignedToMe: '', isUrgent: '',
    studentName: '', page: 1, limit: 15, sortBy: 'submittedDate', sortOrder: 'desc',
  });
  const [searchInput,  setSearchInput]  = useState('');
  const [viewingAppId, setViewingAppId] = useState(null);
  const [stats,        setStats]        = useState(null);

  const fetchApplications = useCallback(async (f = filters) => {
    setAppLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v !== '') params.append(k, v); });
      const res = await apiFetch(`/applications/department?${params.toString()}`);
      setApplications(res.data || []);
      setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
    } catch { toast.error('Failed to load applications'); }
    finally { setAppLoading(false); }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await apiFetch('/applications/department/stats');
      setStats({ ...(res.data?.overall || {}), myPending: res.data?.myPendingCount || 0 });
    } catch {}
  }, []);

  useEffect(() => { fetchApplications(); fetchStats(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const updated = { ...filters, studentName: searchInput, page: 1 };
      setFilters(updated);
      fetchApplications(updated);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const applyFilter = (key, value) => {
    const updated = { ...filters, [key]: value, page: 1 };
    setFilters(updated);
    fetchApplications(updated);
  };

  const goToPage = (p) => {
    const updated = { ...filters, page: p };
    setFilters(updated);
    fetchApplications(updated);
  };

  const statusTabs = [
    { key: '',               label: 'All',       count: stats?.total    || 0 },
    { key: 'pending_review', label: 'My Queue',  count: stats?.myPending || 0 },
    { key: 'pending',        label: 'Pending',   count: stats?.pending  || 0 },
    { key: 'approved',       label: 'Approved',  count: stats?.approved || 0 },
    { key: 'rejected',       label: 'Rejected',  count: stats?.rejected || 0 },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Applications"
        subtitle="All applications in your department"
        icon={Search}
        iconColor="text-blue-500"
        actions={
          <button onClick={() => { fetchApplications(); fetchStats(); }} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${appLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="input-field pl-10"
            placeholder="Search by student name or ID…"
          />
        </div>
        <select value={filters.applicationType} onChange={e => applyFilter('applicationType', e.target.value)} className="input-field w-44">
          <option value="">All Types</option>
          {Object.entries(APP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filters.isUrgent} onChange={e => applyFilter('isUrgent', e.target.value)} className="input-field w-36">
          <option value="">All Priority</option>
          <option value="true">Urgent Only</option>
        </select>
        <select value={filters.assignedToMe} onChange={e => applyFilter('assignedToMe', e.target.value)} className="input-field w-40">
          <option value="">All Assigned</option>
          <option value="true">Assigned to Me</option>
          <option value="false">Others</option>
        </select>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-obsidian-800/60 p-1 rounded-xl w-full overflow-x-auto">
        {statusTabs.map(t => (
          <button
            key={t.key}
            onClick={() => applyFilter('status', t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filters.status === t.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            {t.label} <span className="opacity-60 tabular-nums">({t.count})</span>
          </button>
        ))}
      </div>

      {appLoading ? (
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
        </div>
      ) : applications.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">No applications found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map(app => (
            <AppCard key={app._id} app={app} onView={id => setViewingAppId(id)} />
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400 dark:text-slate-500 text-xs">
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button onClick={() => goToPage(pagination.page - 1)} disabled={pagination.page <= 1} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Previous</button>
            <button onClick={() => goToPage(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {viewingAppId && (
        <AppDetailModal appId={viewingAppId} onClose={() => setViewingAppId(null)} />
      )}
    </div>
  );
}
