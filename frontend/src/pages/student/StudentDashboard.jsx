import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, XCircle,
  ArrowRight, Plus, TrendingUp,
} from 'lucide-react';
import {
  fetchMyApplications,
  selectMyApplications,
  selectApplicationsLoading,
} from '../../store/slices/applicationsSlice';
import { selectUser } from '../../store/slices/authSlice';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';

export default function StudentDashboard() {
  const dispatch     = useDispatch();
  const user         = useSelector(selectUser);
  const applications = useSelector(selectMyApplications);
  const loading      = useSelector(selectApplicationsLoading);

  useEffect(() => { dispatch(fetchMyApplications()); }, [dispatch]);

  const stats = {
    total:    applications.length,
    pending:  applications.filter(a => ['pending', 'under_review', 'forwarded'].includes(a.status)).length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const recent = applications.slice(0, 5);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            Hello, <span className="text-gradient">{user?.firstName}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Track and manage your university applications
          </p>
        </div>
        <Link to="/student/submit" className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> New Application
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total"       value={stats.total}    icon={FileText}    colorClass="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
        <StatCard label="In Progress" value={stats.pending}  icon={Clock}       colorClass="bg-amber-500/15 text-amber-600 dark:text-amber-400" />
        <StatCard label="Approved"    value={stats.approved} icon={CheckCircle} colorClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Rejected"    value={stats.rejected} icon={XCircle}     colorClass="bg-red-500/15 text-red-600 dark:text-red-400" />
      </div>

      {/* Recent Applications */}
      <div className="card overflow-hidden animate-slide-up animate-delay-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Recent Applications
          </h2>
          <Link
            to="/student/applications"
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center">
            <div className="w-8 h-8 border-2 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-obsidian-800/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-7 h-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">No applications yet</p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Submit your first application to get started</p>
            <Link to="/student/submit" className="btn-primary text-sm mt-4 inline-flex">
              <Plus className="w-4 h-4" /> Submit Application
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {recent.map((app, idx) => (
              <Link
                key={app._id}
                to={`/student/applications/${app._id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-obsidian-800/20 transition-colors animate-fade-in group"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {app.title}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    <span className="font-mono">{app.applicationId}</span>
                    {' · '}
                    {APP_TYPE_LABELS?.[app.applicationType] || app.applicationType}
                    {' · '}
                    {formatDate(app.submittedDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {app.isUrgent && (
                    <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-md px-1.5 py-0.5 font-medium">
                      URGENT
                    </span>
                  )}
                  <StatusBadge status={app.status} />
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-blue-400 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
