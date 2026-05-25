import React, { useEffect, useCallback, useState } from 'react';
import {
  Users, UserCheck, Activity, BadgeAlert, RefreshCw,
} from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import PageHeader from '../../components/common/PageHeader';
import toast from 'react-hot-toast';

const apiFetch = async (path, options = {}) => {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:7800/api/v1';
  const res  = await fetch(`${base}${path}`, { credentials: 'include', ...options });
  if (!res.ok) throw new Error((await res.json()).message || 'Request failed');
  return res.json();
};

const WorkloadBar = ({ staff }) => {
  const pct = Math.min((staff.workload.pending / 10) * 100, 100);
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-white/5 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 text-xs font-bold text-blue-500">
        {staff.firstName?.[0]}{staff.lastName?.[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{staff.firstName} {staff.lastName}</p>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {staff.workload.urgent > 0 && (
              <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/25 rounded-full px-1.5 py-0.5 flex items-center gap-1">
                <BadgeAlert className="w-2.5 h-2.5" />{staff.workload.urgent}
              </span>
            )}
            <span className="text-xs text-gray-500 dark:text-slate-400 tabular-nums">{staff.workload.pending} pending</span>
          </div>
        </div>
        <div className="h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              pct > 70 ? 'bg-red-500' : pct > 40 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-[10px] text-gray-400 dark:text-slate-500 capitalize">{staff.role?.replace(/_/g, ' ')}</p>
        {staff.staffType && <p className="text-[10px] text-gray-400 dark:text-slate-600 capitalize">{staff.staffType?.replace(/_/g, ' ')}</p>}
      </div>
    </div>
  );
};

export default function HODStaffPage() {
  const [staffWorkload, setStaffWorkload] = useState([]);
  const [loading,       setLoading]       = useState(true);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/applications/department/staff-workload');
      setStaffWorkload(res.data || []);
    } catch { toast.error('Failed to load staff workload'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, []);

  const avgLoad = staffWorkload.length
    ? (staffWorkload.reduce((a, s) => a + s.workload.pending, 0) / staffWorkload.length).toFixed(1)
    : 0;

  const healthStats = [
    { label: 'Total Staff',   value: staffWorkload.length,                                      sub: 'In department',   colorClass: 'bg-blue-500/15 text-blue-500',   icon: Users },
    { label: 'Overloaded',    value: staffWorkload.filter(s => s.workload.pending >= 5).length, sub: '5+ pending apps', colorClass: 'bg-red-500/15 text-red-500',         icon: BadgeAlert },
    { label: 'With Urgent',   value: staffWorkload.filter(s => s.workload.urgent > 0).length,   sub: 'Has urgent items', colorClass: 'bg-amber-500/15 text-amber-500',    icon: Activity },
    { label: 'Avg Load',      value: avgLoad,                                                   sub: 'Apps per staff',  colorClass: 'bg-emerald-500/15 text-emerald-500', icon: UserCheck },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Staff Workload"
        subtitle="Workload distribution across department staff"
        icon={Users}
        iconColor="text-blue-500"
        actions={
          <button onClick={fetchStaff} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {healthStats.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} colorClass={s.colorClass} sub={s.sub} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-white/5/60">
            <UserCheck className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Pending Workload</h3>
          </div>
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : staffWorkload.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-6">No staff found</p>
            ) : (
              staffWorkload.map(s => <WorkloadBar key={s._id} staff={s} />)
            )}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 dark:border-white/5/60">
            <Users className="w-4 h-4 text-teal-500" />
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Staff Directory</h3>
          </div>
          <div className="p-4 space-y-2 max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-gray-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : staffWorkload.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-6">No staff found</p>
            ) : (
              staffWorkload.map(s => (
                <div key={s._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-obsidian-850/40 hover:bg-gray-100 dark:hover:bg-obsidian-800/30 transition-colors border border-gray-100 dark:border-white/5">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-500 flex-shrink-0">
                    {s.firstName?.[0]}{s.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white font-medium">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 capitalize">
                      {s.role?.replace(/_/g, ' ')}{s.staffType ? ` · ${s.staffType.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 tabular-nums">{s.workload.pending}</p>
                    <p className="text-[10px] text-gray-400 dark:text-slate-600">pending</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
