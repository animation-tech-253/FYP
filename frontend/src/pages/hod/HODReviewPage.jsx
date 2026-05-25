import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  CheckCircle, XCircle, Inbox, Search, Forward,
  ChevronDown, ChevronUp, FileText, RefreshCw,
  ShieldCheck, AlertTriangle, Send,
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
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const EXAMINER_REQUIRED_TYPES = new Set([
  'result_card_request',
  'certificate_request',
  'transcript_request',
]);

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0e1f38',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: '12px',
  },
};

function ReviewCard({ app, user, dispatch }) {
  const [expanded,       setExpanded]       = useState(false);
  const [action,         setAction]         = useState('');
  const [remarks,        setRemarks]        = useState('');
  const [newRecipientId, setNewRecipientId] = useState('');
  const [processing,     setProcessing]     = useState(false);

  const canAct =
    (app.status === 'pending' || app.status === 'forwarded') &&
    app.currentRecipient?._id?.toString() === user?._id?.toString();

  // Workflow flags returned by getApplicationsForReview
  const needsExaminerFirst   = app.needsExaminerFirst   || false;
  const awaitingFinalApproval = app.awaitingFinalApproval || false;

  const actions = [
    { value: 'approved',  label: 'Approve', icon: CheckCircle, style: 'border-emerald-500/40 text-emerald-500', active: 'bg-emerald-600 border-emerald-600 text-white' },
    { value: 'rejected',  label: 'Reject',  icon: XCircle,     style: 'border-red-500/40 text-red-500',         active: 'bg-red-600 border-red-600 text-white' },
    { value: 'forwarded', label: 'Forward', icon: Forward,     style: 'border-purple-500/40 text-purple-500',   active: 'bg-blue-600 border-blue-600 text-white' },
  ];

  const handleProcess = async () => {
    if (!action) { toast.error('Select an action'); return; }
    if (action === 'forwarded' && !newRecipientId) { toast.error('Select a recipient to forward to'); return; }
    setProcessing(true);
    try {
      await dispatch(processApplication({ id: app._id, data: { action, remarks, newRecipientId } }));
      setAction(''); setRemarks(''); setNewRecipientId('');
      setExpanded(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleForwardToExamOfficer = async () => {
    setProcessing(true);
    try {
      await dispatch(processApplication({
        id: app._id,
        data: {
          action:        'forwarded',
          recipientRole: 'examination_officer',
          remarks:       'Forwarded to Examination Officer for transcript verification.',
        },
      }));
      setExpanded(false);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="card overflow-hidden animate-fade-in">
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
            {needsExaminerFirst && (
              <span className="text-[10px] bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 rounded-full px-2 py-0.5">Needs Verification</span>
            )}
            {awaitingFinalApproval && (
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 rounded-full px-2 py-0.5 font-medium">Transcript Verified ✓</span>
            )}
            <StatusBadge status={app.status} />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
            {app.student?.firstName} {app.student?.lastName}
            {app.student?.studentId ? ` · ${app.student.studentId}` : ''}
            {' · '}{app.department?.name}
            {' · '}{formatDate(app.submittedDate)}
          </p>
        </div>
        {expanded
          ? <ChevronUp   className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 dark:text-slate-500 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-white/5/60 px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-obsidian-850/50 rounded-xl p-4">
            {[
              { label: 'Application ID', value: <span className="font-mono text-xs">{app.applicationId}</span> },
              { label: 'Type', value: APP_TYPE_LABELS?.[app.applicationType] || app.applicationType },
              { label: 'Student ID',  value: app.student?.studentId || '—' },
              { label: 'Submitted',   value: formatDate(app.submittedDate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-gray-400 dark:text-slate-500 text-xs mb-0.5">{label}</p>
                <p className="text-gray-700 dark:text-slate-200 text-xs font-medium">{value}</p>
              </div>
            ))}
            <div className="col-span-2">
              <p className="text-gray-400 dark:text-slate-500 text-xs mb-0.5">Description</p>
              <p className="text-gray-600 dark:text-slate-300 text-xs leading-relaxed">{app.description}</p>
            </div>
          </div>

          <AttachmentsPanel attachments={app.attachments} />

          {/* Transcript verified — HOD should give final decision */}
          {awaitingFinalApproval && canAct && (
            <div className="flex items-start gap-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <span className="font-semibold block mb-0.5">Transcript verified by Examination Officer</span>
                {app.academicVerification?.remarks && (
                  <span className="italic block mb-1">Examiner notes: "{app.academicVerification.remarks}"</span>
                )}
                Please review and give your final approval or rejection below.
              </div>
            </div>
          )}

          {/* Needs examiner verification first — HOD should forward */}
          {needsExaminerFirst && canAct && (
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold mb-1">Transcript verification required</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                  This application type requires the Examination Officer to verify the transcript before you can give final approval.
                </p>
                <button
                  onClick={handleForwardToExamOfficer}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {processing
                    ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5" />}
                  Forward to Examination Officer
                </button>
              </div>
            </div>
          )}

          {canAct ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Take Action</p>
              <div className="flex gap-2 flex-wrap">
                {actions.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setAction(prev => prev === a.value ? '' : a.value)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                      action === a.value ? a.active : `bg-gray-50 dark:bg-obsidian-800 ${a.style} hover:bg-gray-100 dark:hover:bg-obsidian-800/60`
                    }`}
                  >
                    <a.icon className="w-3.5 h-3.5" />
                    {a.label}
                  </button>
                ))}
              </div>

              {action === 'forwarded' && (
                <div>
                  <label className="label mb-2 block">Forward To</label>
                  <ForwardRecipientPicker
                    value={newRecipientId}
                    onChange={setNewRecipientId}
                    excludeUserId={user?._id}
                    excludeRoles={!EXAMINER_REQUIRED_TYPES.has(app.applicationType) ? ['examination_officer'] : []}
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
                      onClick={() => { setAction(''); setRemarks(''); setNewRecipientId(''); }}
                      className="btn-secondary flex-1 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleProcess}
                      disabled={processing || (action === 'forwarded' && !newRecipientId)}
                      className="btn-primary flex-1 text-sm gap-2 disabled:opacity-50"
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
            <div className="text-xs text-gray-400 dark:text-slate-500 space-y-1 bg-gray-50 dark:bg-obsidian-850/40 rounded-xl p-3">
              <p className="capitalize">Status: <span className="font-semibold text-gray-600 dark:text-slate-300">{app.status?.replace(/_/g, ' ')}</span></p>
              {app.currentRecipient && (
                <p>Currently with: <span className="font-semibold text-gray-600 dark:text-slate-300">
                  {app.currentRecipient.firstName} {app.currentRecipient.lastName} ({app.currentRecipient.role?.replace(/_/g, ' ')})
                </span></p>
              )}
              {app.finalRemarks && <p>Remarks: <span className="italic text-gray-500 dark:text-slate-400">"{app.finalRemarks}"</span></p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HODReviewPage() {
  const dispatch     = useDispatch();
  const user         = useSelector(selectUser);
  const applications = useSelector(selectReviewApplications);
  const loading      = useSelector(selectApplicationsLoading);
  const error        = useSelector(selectApplicationError);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { dispatch(fetchReviewApplications()); }, [dispatch]);

  const filtered = applications
    .filter(a =>
      !search ||
      a.title?.toLowerCase().includes(search.toLowerCase()) ||
      `${a.student?.firstName} ${a.student?.lastName}`.toLowerCase().includes(search.toLowerCase())
    )
    .filter(a => filter === 'all' || a.status === filter);

  const needsAction = applications.filter(a =>
    (a.status === 'pending' || a.status === 'forwarded') &&
    a.currentRecipient?._id?.toString() === user?._id?.toString()
  ).length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="My Review Queue"
        subtitle="Applications assigned to you for review"
        icon={CheckCircle}
        iconColor="text-emerald-500"
        actions={
          <button onClick={() => dispatch(fetchReviewApplications())} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Needs My Action" value={needsAction}                                                icon={Inbox}       colorClass="bg-blue-500/15 text-blue-500" />
        <StatCard label="Approved"        value={applications.filter(a => a.status === 'approved').length} icon={CheckCircle} colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Rejected"        value={applications.filter(a => a.status === 'rejected').length} icon={XCircle}     colorClass="bg-red-500/15 text-red-500" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10"
            placeholder="Search by title or student name…"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-obsidian-800/60 p-1 rounded-xl overflow-x-auto flex-shrink-0">
          {['all', 'pending', 'forwarded', 'approved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all capitalize ${
                filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white'
              }`}
            >
              {f.replace('_', ' ')}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">({applications.filter(a => a.status === f).length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="w-7 h-7 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <Inbox className="w-10 h-10 text-red-300 dark:text-red-800 mx-auto mb-3" />
          <p className="text-red-500 font-medium">Failed to load applications</p>
          <button onClick={() => dispatch(fetchReviewApplications())} className="btn-primary mt-4 text-sm">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Inbox className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400 font-medium">
            {filter === 'all' ? 'No applications assigned to you yet' : `No ${filter} applications`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => (
            <ReviewCard key={app._id} app={app} user={user} dispatch={dispatch} />
          ))}
        </div>
      )}
    </div>
  );
}
