import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Inbox, CheckCircle, AlertTriangle, XCircle, Activity,
  Clock, RefreshCw,
} from 'lucide-react';
import {
  fetchVCPersonal,
  selectVCInbox, selectVCMyStats, selectVCRecentlyActioned, selectVCPersonalLoading,
  selectVCError,
} from '../../store/slices/vcSlice';
import { processApplication } from '../../store/slices/applicationsSlice';
import { formatDate, formatDistanceToNow } from '../../utils/helpers';
import AttachmentsPanel from '../../components/common/AttachmentsPanel';
import StatCard from '../../components/common/StatCard';
import SectionHeader from '../../components/common/SectionHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';

const UrgentRow = ({ app, idx }) => (
  <div
    className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 animate-fade-in"
    style={{ animationDelay: `${idx * 30}ms` }}
  >
    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-blue-500">{app.applicationId}</span>
        <span className="text-gray-900 dark:text-white text-sm font-medium truncate">{app.title}</span>
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
        {app.student?.firstName} {app.student?.lastName}
        {app.department?.name ? ` · ${app.department.name}` : ''}
      </p>
      <div className="flex items-center gap-1.5 mt-1">
        <Clock className="w-3 h-3 text-gray-400 dark:text-slate-600" />
        <span className="text-gray-400 dark:text-slate-500 text-xs">Waiting {formatDistanceToNow(app.submittedDate)}</span>
      </div>
    </div>
  </div>
);

function InboxCard({ app, idx, onProcess }) {
  const [showActions, setShowActions] = useState(false);
  const [remarks,     setRemarks]     = useState('');
  const [action,      setAction]      = useState('');

  const handleAction = (a) => { setAction(a); setShowActions(true); };
  const handleSubmit = () => {
    onProcess(app._id, { action, remarks });
    setShowActions(false); setRemarks(''); setAction('');
  };

  return (
    <div
      className={`card p-4 animate-fade-in ${app.isUrgent ? 'border-red-200 dark:border-red-500/25 bg-red-50/30 dark:bg-red-500/5' : ''}`}
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono text-xs text-blue-500">{app.applicationId}</span>
            {app.isUrgent && (
              <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-2 py-0.5 font-medium">URGENT</span>
            )}
            <StatusBadge status={app.status} />
          </div>
          <p className="text-gray-900 dark:text-white text-sm font-semibold truncate">{app.title}</p>
          <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
            {app.student?.firstName} {app.student?.lastName}{app.student?.studentId ? ` · ${app.student.studentId}` : ''}
          </p>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
            {app.department?.name} · {formatDistanceToNow(app.submittedDate)} ago
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => handleAction('approved')}  className="px-3 py-1.5 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors font-medium">Approve</button>
          <button onClick={() => handleAction('rejected')}  className="px-3 py-1.5 text-xs rounded-lg bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/25 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors font-medium">Reject</button>
          <button onClick={() => handleAction('forwarded')} className="px-3 py-1.5 text-xs rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/25 hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors font-medium">Forward</button>
        </div>
      </div>

      {app.description && (
        <div className="mt-3">
          <p className="text-gray-400 dark:text-slate-500 text-xs mb-1">Description</p>
          <p className="text-gray-600 dark:text-slate-300 text-xs leading-relaxed">{app.description}</p>
        </div>
      )}
      {app.attachments?.length > 0 && (
        <div className="mt-3"><AttachmentsPanel attachments={app.attachments} /></div>
      )}

      {showActions && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5/60 space-y-2 animate-fade-in">
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            className="input-field resize-none text-sm"
            rows={2}
            placeholder={action === 'approved' ? 'Optional remarks…' : 'Remarks required…'}
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowActions(false); setRemarks(''); }} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
            <button onClick={handleSubmit} className="btn-primary text-xs px-3 py-1.5">Confirm {action}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VCDashboard() {
  const dispatch = useDispatch();
  const inbox    = useSelector(selectVCInbox);
  const myStats  = useSelector(selectVCMyStats);
  const actioned = useSelector(selectVCRecentlyActioned);
  const loading  = useSelector(selectVCPersonalLoading);
  const error    = useSelector(selectVCError);

  useEffect(() => { dispatch(fetchVCPersonal()); }, [dispatch]);

  const handleProcess = (id, data) => {
    dispatch(processApplication({ id, data })).then(() => dispatch(fetchVCPersonal()));
  };

  if (loading && !inbox.totalCount && !actioned.length) return <LoadingSpinner />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="My Inbox"
        subtitle="Applications assigned to you for review and action"
        icon={Inbox}
        iconColor="text-blue-500"
        actions={
          <button onClick={() => dispatch(fetchVCPersonal())} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="card p-6 text-center">
          <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-gray-700 dark:text-white font-medium">{error}</p>
          <button onClick={() => dispatch(fetchVCPersonal())} className="btn-primary mt-3 text-sm">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="In My Queue"    value={inbox.totalCount}                   icon={Inbox}         colorClass="bg-blue-500/15 text-blue-500" sub="Needs my action" />
        <StatCard label="Urgent"         value={inbox.urgentCount}                  icon={AlertTriangle} colorClass="bg-red-500/15 text-red-500" urgent={inbox.urgentCount > 0} />
        <StatCard label="Total Approved" value={myStats?.applicationsAccepted ?? 0} icon={CheckCircle}   colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Total Rejected" value={myStats?.applicationsRejected ?? 0} icon={XCircle}       colorClass="bg-red-500/15 text-red-500" />
      </div>

      {inbox.urgent?.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={AlertTriangle} title="Urgent — Needs Immediate Action" count={`${inbox.urgentCount} urgent`} colorClass="text-red-500" />
          <div className="p-4 space-y-2">
            {inbox.urgent.map((app, i) => <UrgentRow key={app._id} app={app} idx={i} />)}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <SectionHeader icon={Inbox} title="Pending Applications" count={`${inbox.totalCount || 0} total`} />
        {!inbox.all?.length ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500/30 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Your inbox is clear</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">No applications pending your review</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {inbox.all.map((app, i) => <InboxCard key={app._id} app={app} idx={i} onProcess={handleProcess} />)}
          </div>
        )}
      </div>

      {actioned.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Activity} title="Recently Actioned" count="Last 15" />
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {actioned.map((h, i) => (
              <div key={h._id || i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  h.action === 'approved' || h.action === 'verified' ? 'bg-emerald-400' :
                  h.action === 'rejected' ? 'bg-red-400' :
                  h.action === 'forwarded' ? 'bg-purple-400' : 'bg-slate-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-500">{h.application?.applicationId}</span>
                    <span className="text-gray-900 dark:text-white text-sm truncate font-medium">{h.application?.title}</span>
                  </div>
                  <p className="text-gray-400 dark:text-slate-500 text-xs capitalize">
                    {h.application?.department?.name}{h.action ? ` · ${h.action}` : ''}
                  </p>
                </div>
                <span className="text-gray-400 dark:text-slate-500 text-xs flex-shrink-0">{formatDate(h.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
