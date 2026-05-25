import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Inbox, CheckCircle, XCircle,
  Search, FileText, ChevronDown, ChevronUp, Forward, Download,
} from 'lucide-react';
import {
  fetchReviewApplications,
  processApplication,
  selectReviewApplications,
  selectApplicationsLoading,
  selectApplicationError,
} from '../../store/slices/applicationsSlice';
import { selectUser } from '../../store/slices/authSlice';
import ForwardRecipientPicker from '../../components/common/ForwardRecipientPicker';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import StatusBadge from '../../components/common/StatusBadge';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import { applicationAPI } from '../../services/api';
import toast from 'react-hot-toast';

function ApplicationCard({ app, user, dispatch }) {
  const [expanded,       setExpanded]       = useState(false);
  const [action,         setAction]         = useState('');
  const [remarks,        setRemarks]        = useState('');
  const [newRecipientId, setNewRecipientId] = useState('');
  const [cgpa,           setCgpa]           = useState('');
  const [processing,     setProcessing]     = useState(false);

  const isExamOfficer = user?.role === 'examination_officer';

  const downloadPDF = async () => {
    try {
      const res = await applicationAPI.getPDF(app._id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `Application_${app.applicationId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleProcess = async () => {
    if (!action) { toast.error('Select an action'); return; }
    if (action === 'forwarded' && !newRecipientId) { toast.error('Select a recipient to forward to'); return; }
    if (action === 'verified' && !cgpa) { toast.error('Enter student CGPA'); return; }

    setProcessing(true);
    const payload = { action, remarks, newRecipientId };
    if (action === 'verified') payload.verificationData = { cgpa: parseFloat(cgpa), remarks };

    await dispatch(processApplication({ id: app._id, data: payload }));

    setAction(''); setRemarks(''); setNewRecipientId(''); setCgpa('');
    setExpanded(false);
    setProcessing(false);
  };

  const canAct =
    (app.status === 'pending' || app.status === 'forwarded') &&
    app.currentRecipient?._id?.toString() === user?._id?.toString();

  const actions = isExamOfficer
    ? [
        { value: 'verified', label: 'Verify',  icon: CheckCircle, style: 'border-emerald-500/40 text-emerald-400', active: 'bg-emerald-600 border-emerald-600 text-white' },
        { value: 'rejected', label: 'Reject',  icon: XCircle,     style: 'border-red-500/40 text-red-400',         active: 'bg-red-600 border-red-600 text-white' },
      ]
    : [
        { value: 'approved',  label: 'Approve', icon: CheckCircle, style: 'border-emerald-500/40 text-emerald-400', active: 'bg-emerald-600 border-emerald-600 text-white' },
        { value: 'rejected',  label: 'Reject',  icon: XCircle,     style: 'border-red-500/40 text-red-400',         active: 'bg-red-600 border-red-600 text-white' },
        { value: 'forwarded', label: 'Forward', icon: Forward,     style: 'border-purple-500/40 text-purple-400',   active: 'bg-blue-600 border-blue-600 text-white' },
      ];

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div
        className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.title}</p>
            {app.isUrgent && (
              <span className="text-[10px] bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded px-1">URGENT</span>
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
            onClick={e => { e.stopPropagation(); downloadPDF(); }}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-white/5/50 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Application ID</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs font-mono">{app.applicationId}</p>
            </div>
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Type</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs">{APP_TYPE_LABELS?.[app.applicationType] || app.applicationType}</p>
            </div>
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Student ID</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs font-mono">{app.student?.studentId || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Submitted</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs">{formatDate(app.submittedDate)}</p>
            </div>
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
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Priority</p>
              <p className={`text-xs ${app.isUrgent ? 'text-red-500 font-medium' : 'text-slate-700 dark:text-slate-200'}`}>
                {app.isUrgent ? 'Urgent' : 'Normal'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-0.5 font-semibold uppercase tracking-wider text-[10px]">Department</p>
              <p className="text-slate-700 dark:text-slate-200 text-xs">{app.department?.name || '—'}</p>
            </div>
          </div>

          {app.description && (
            <div>
              <p className="text-slate-400 dark:text-slate-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">Description</p>
              <p className="text-slate-700 dark:text-slate-300 text-xs leading-relaxed">{app.description}</p>
            </div>
          )}

          <AttachmentsPanel attachments={app.attachments} />

          {canAct ? (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Take Action</p>

              <div className="flex gap-2 flex-wrap">
                {actions.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAction(prev => prev === a.value ? '' : a.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      action === a.value ? a.active : `bg-gray-100 dark:bg-obsidian-800 ${a.style} hover:text-white`
                    }`}
                  >
                    <a.icon className="w-3.5 h-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>

              {isExamOfficer && action === 'verified' && (
                <div>
                  <label className="label">Student CGPA</label>
                  <input
                    type="number" step="0.01" min="0" max="4"
                    value={cgpa}
                    onChange={e => setCgpa(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 3.50"
                  />
                </div>
              )}

              {action === 'forwarded' && (
                <div>
                  <label className="label mb-2 block">Forward To</label>
                  <ForwardRecipientPicker
                    value={newRecipientId}
                    onChange={setNewRecipientId}
                    excludeUserId={user?._id}
                  />
                </div>
              )}

              {action && (
                <>
                  <div>
                    <label className="label">
                      Remarks {action === 'rejected' ? '(Required)' : '(Optional)'}
                    </label>
                    <textarea
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      className="input-field resize-none"
                      rows={3}
                      placeholder="Add remarks or feedback…"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setAction(''); setRemarks(''); setNewRecipientId(''); setCgpa(''); }}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProcess}
                      disabled={
                        processing ||
                        (action === 'forwarded' && !newRecipientId) ||
                        (action === 'verified'  && !cgpa)
                      }
                      className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {processing
                        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                        : 'Submit Decision'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-slate-400 space-y-1">
              <p className="italic capitalize">
                Status: <span className="font-medium text-gray-700 dark:text-slate-200">{app.status?.replace(/_/g, ' ')}</span>
              </p>
              {app.currentRecipient && (
                <p>
                  Currently with:{' '}
                  <span className="text-gray-700 dark:text-slate-300 font-medium">
                    {app.currentRecipient.firstName} {app.currentRecipient.lastName}
                    {' '}({app.currentRecipient.role?.replace(/_/g, ' ')})
                  </span>
                </p>
              )}
              {app.finalRemarks && (
                <p>Remarks: <span className="text-gray-700 dark:text-slate-300">{app.finalRemarks}</span></p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffDashboard() {
  const dispatch     = useDispatch();
  const user         = useSelector(selectUser);
  const applications = useSelector(selectReviewApplications);
  const loading      = useSelector(selectApplicationsLoading);
  const error        = useSelector(selectApplicationError);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { dispatch(fetchReviewApplications()); }, [dispatch]);

  const afterSearch = applications.filter(a =>
    !search ||
    a.title?.toLowerCase().includes(search.toLowerCase()) ||
    `${a.student?.firstName} ${a.student?.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = afterSearch.filter(a => filter === 'all' || a.status === filter);

  const needsAction = applications.filter(
    a => (a.status === 'pending' || a.status === 'forwarded') &&
         a.currentRecipient?._id?.toString() === user?._id?.toString()
  ).length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Review Applications"
        subtitle="Applications awaiting your decision"
        icon={Inbox}
        iconColor="text-blue-500"
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Needs Action" value={needsAction}                                               icon={Inbox}      colorClass="bg-blue-500/15 text-blue-500" urgent={needsAction > 0} />
        <StatCard label="Approved"     value={applications.filter(a => a.status === 'approved').length}  icon={CheckCircle} colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Rejected"     value={applications.filter(a => a.status === 'rejected').length}  icon={XCircle}     colorClass="bg-red-500/15 text-red-500" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9 text-sm"
            placeholder="Search by title or student name…"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-obsidian-800/60 p-1 rounded-lg overflow-x-auto flex-shrink-0">
          {['all', 'pending', 'forwarded', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors capitalize ${
                filter === f ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {f.replace('_', ' ')}
              {f !== 'all' && (
                <span className="ml-1 text-[10px] opacity-70">
                  ({applications.filter(a => a.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <Inbox className="w-12 h-12 text-red-300 dark:text-red-700 mx-auto mb-3" />
          <p className="text-red-500 dark:text-red-400 font-medium">Failed to load applications</p>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{error}</p>
          <button onClick={() => dispatch(fetchReviewApplications())} className="btn-primary mt-4 text-sm">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">
            {filter === 'all' ? 'No applications assigned to you yet' : `No ${filter} applications`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ApplicationCard key={app._id} app={app} user={user} dispatch={dispatch} />
          ))}
        </div>
      )}
    </div>
  );
}