import React, { useEffect, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Clock, CheckCircle, XCircle,
  AlertTriangle, TrendingUp, BarChart3, Activity,
  RefreshCw, Inbox, ArrowRight,
} from 'lucide-react';
import { selectUser } from '../../store/slices/authSlice';
import StatCard from '../../components/common/StatCard';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';
import { APP_TYPE_LABELS, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const apiFetch = async (path, options = {}) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';
  const res  = await fetch(`${base}${path}`, { credentials: 'include', ...options });
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
};

export default function HODDashboard() {
  const user     = useSelector(selectUser);
  const navigate = useNavigate();

  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch('/applications/department/stats');
      setStats(res.data);
    } catch { toast.error('Failed to load stats'); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const overall    = stats?.overall       || {};
  const byType     = stats?.byType        || [];
  const recentApps = stats?.recentActivity || [];
  const myPending  = stats?.myPendingCount ?? 0;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={`Welcome, ${user?.firstName}`}
        subtitle="Department overview — select a section from the sidebar to manage applications or staff"
        icon={BarChart3}
        iconColor="text-blue-500"
        actions={
          <button onClick={fetchStats} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Primary stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 dark:bg-obsidian-800/40 rounded-2xl animate-pulse border border-gray-100 dark:border-white/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
            <StatCard label="Total Applications" value={overall.total}    icon={FileText}    colorClass="bg-blue-500/15 text-blue-500" />
            <StatCard label="Pending Review"     value={overall.pending}  icon={Clock}       colorClass="bg-amber-500/15 text-amber-500"   />
            <StatCard label="Approved"           value={overall.approved} icon={CheckCircle} colorClass="bg-emerald-500/15 text-emerald-500"/>
            <StatCard label="Rejected"           value={overall.rejected} icon={XCircle}     colorClass="bg-red-500/15 text-red-500"        />
          </div>

          <div className="grid grid-cols-3 gap-4 animate-slide-up">
            <StatCard
              label="My Review Queue"
              value={myPending}
              icon={Inbox}
              colorClass="bg-purple-500/15 text-purple-500"
              sub="Applications assigned to you"
              urgent={myPending > 0}
            />
            <StatCard
              label="Urgent Cases"
              value={overall.urgent}
              icon={AlertTriangle}
              colorClass="bg-red-500/15 text-red-500"
              urgent={overall.urgent > 0}
            />
            <StatCard
              label="Avg Processing"
              value={overall.avgProcessingTimeDays != null ? `${overall.avgProcessingTimeDays.toFixed(1)}d` : '—'}
              icon={TrendingUp}
              colorClass="bg-teal-500/15 text-teal-500"
              sub="Days per application"
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Type */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-white/5/60">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">By Application Type</h3>
          </div>
          <div className="p-5">
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-6 bg-gray-100 dark:bg-obsidian-800/30 rounded-lg animate-pulse" />)}
              </div>
            ) : byType.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-6">No data available</p>
            ) : (
              <div className="space-y-3">
                {byType.map(t => {
                  const pct = overall.total ? Math.round((t.count / overall.total) * 100) : 0;
                  return (
                    <div key={t._id}>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className="text-gray-600 dark:text-slate-300 font-medium">{APP_TYPE_LABELS?.[t._id] || t._id}</span>
                        <span className="text-gray-500 dark:text-slate-400 tabular-nums font-medium">{t.count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-white/5/60">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Recent Activity</h3>
            </div>
            <button
              onClick={() => navigate('/hod/applications')}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 font-medium transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-white/5">
            {statsLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-obsidian-800/30 rounded-xl animate-pulse" />)}
              </div>
            ) : recentApps.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-8">No recent applications</p>
            ) : (
              recentApps.slice(0, 6).map(app => (
                <div
                  key={app._id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-obsidian-800/20 transition-colors cursor-pointer"
                  onClick={() => navigate('/hod/applications')}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${app.isUrgent ? 'bg-red-400' : 'bg-blue-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium truncate">{app.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                      {app.student?.firstName} {app.student?.lastName} · {formatDate(app.submittedDate)}
                    </p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
