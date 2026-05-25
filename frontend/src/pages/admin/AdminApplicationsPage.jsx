import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FileText, Search, Download, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import {
  fetchAllApplicationsAdmin,
  selectAdminApplications,
  selectApplicationsLoading,
  setFilters,
  selectFilters,
} from '../../store/slices/applicationsSlice';
import { departmentAPI, applicationAPI } from '../../services/api';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

function InfoField({ label, value, mono = false, className = '' }) {
  return (
    <div>
      <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">{label}</p>
      <p className={`text-slate-700 dark:text-slate-200 text-xs ${mono ? 'font-mono' : ''} ${className}`}>{value || '—'}</p>
    </div>
  );
}

function AppCard({ app, onDownload }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* ── Collapsed header ── */}
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-obsidian-800/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600/15 dark:bg-blue-600/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-blue-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{app.title}</p>
            {app.isUrgent && (
              <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5 font-medium">URGENT</span>
            )}
            <StatusBadge status={app.status} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {app.student?.firstName} {app.student?.lastName}
            {app.student?.studentId ? ` · ${app.student.studentId}` : ''}
            {app.department?.name ? ` · ${app.department.name}` : ''}
            {' · '}{formatDate(app.submittedDate)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onDownload(app._id, app.applicationId); }}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />}
        </div>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-4 border-t border-slate-100 dark:border-white/5 space-y-4">

          {/* Meta grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoField label="Application ID" value={app.applicationId} mono />
            <InfoField label="Type" value={APP_TYPE_LABELS[app.applicationType] || app.applicationType} />
            <InfoField label="Submitted" value={formatDate(app.submittedDate)} />
            <InfoField label="Priority" value={app.isUrgent ? 'Urgent' : 'Normal'} className={app.isUrgent ? '!text-red-500 font-medium' : ''} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Student</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs font-medium">
                {app.student?.firstName} {app.student?.lastName}
              </p>
              {app.student?.email && (
                <p className="text-slate-400 dark:text-slate-500 text-xs">{app.student.email}</p>
              )}
            </div>
            <InfoField label="Student ID" value={app.student?.studentId} mono />
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Currently With</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs">
                {app.currentRecipient
                  ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}`
                  : '—'}
              </p>
              {app.currentRecipient?.role && (
                <p className="text-slate-400 dark:text-slate-500 text-xs capitalize">
                  {app.currentRecipient.role.replace(/_/g, ' ')}
                </p>
              )}
            </div>
            <InfoField label="Department" value={app.department?.name} />
          </div>

          {/* Description */}
          {app.description && (
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">Description</p>
              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{app.description}</p>
            </div>
          )}

          {/* Final remarks */}
          {app.finalRemarks && (
            <div className="bg-slate-50 dark:bg-obsidian-800/60 rounded-lg p-3 border border-slate-100 dark:border-white/5">
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Final Remarks</p>
              <p className="text-slate-700 dark:text-slate-300 text-xs italic">"{app.finalRemarks}"</p>
            </div>
          )}

          {/* Attachments */}
          {app.attachments?.length > 0 && <AttachmentsPanel attachments={app.attachments} />}

          {/* Status footer */}
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-white/5">
            <span>Status: <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{app.status?.replace(/_/g, ' ')}</span></span>
            {app.currentRecipient && (
              <span>
                Currently with: <span className="font-medium text-slate-700 dark:text-slate-300">
                  {app.currentRecipient.firstName} {app.currentRecipient.lastName}
                  {app.currentRecipient.role ? ` (${app.currentRecipient.role.replace(/_/g, ' ')})` : ''}
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminApplicationsPage() {
  const dispatch     = useDispatch();
  const applications = useSelector(selectAdminApplications);
  const loading      = useSelector(selectApplicationsLoading);
  const filters      = useSelector(selectFilters);

  const [search,      setSearch]      = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    dispatch(fetchAllApplicationsAdmin(filters));
  }, [filters, dispatch]);

  useEffect(() => {
    departmentAPI.getAll()
      .then(r => setDepartments(r.data.data || []))
      .catch(() => {});
  }, []);

  const filtered = applications.filter(a =>
    !search ||
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.applicationId?.toLowerCase().includes(search.toLowerCase()) ||
    `${a.student?.firstName} ${a.student?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const downloadPDF = async (id, appId) => {
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
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6 pb-8">

      <div className="flex items-start justify-between animate-fade-in">
        <PageHeader
          title="All Applications"
          subtitle={`${applications.length} total records`}
          icon={FileText}
          iconColor="text-blue-500"
        />
        <button
          onClick={() => dispatch(fetchAllApplicationsAdmin(filters))}
          className="btn-secondary flex items-center gap-2 text-sm mt-1"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-3 animate-slide-up">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search by title, ID or student…"
          />
        </div>
        <select
          value={filters.status || ''}
          onChange={e => dispatch(setFilters({ status: e.target.value }))}
          className="input-field w-40"
        >
          <option value="">All Status</option>
          {['pending', 'under_review', 'forwarded', 'approved', 'rejected', 'completed'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={filters.applicationType || ''}
          onChange={e => dispatch(setFilters({ applicationType: e.target.value }))}
          className="input-field w-44"
        >
          <option value="">All Types</option>
          {Object.entries(APP_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.department || ''}
          onChange={e => dispatch(setFilters({ department: e.target.value }))}
          className="input-field w-44"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="card p-10 flex justify-center animate-slide-up">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center animate-slide-up">
          <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-obsidian-800/50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">No applications found</p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up animate-delay-100">
          {filtered.map(app => (
            <AppCard key={app._id} app={app} onDownload={downloadPDF} />
          ))}
        </div>
      )}
    </div>
  );
}
