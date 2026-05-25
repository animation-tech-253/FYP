import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BarChart3, FileText, CheckCircle, AlertTriangle, Clock,
  Building2, TrendingUp, RefreshCw, Activity, ChevronRight,
  ArrowLeft, Users, XCircle, Zap, Crown, BookOpen, Globe,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  fetchVCUniversity, fetchVCDepartment,
  selectVCTotals, selectVCByDepartment, selectVCByType,
  selectVCUrgentPending, selectVCRecentApplications,
  selectVCExamOfficerWorkload, selectVCMyPendingCount, selectVCUniversityLoading,
  selectVCSelectedDepartment, selectVCDepartmentLoading,
  clearSelectedDepartment, selectVCError,
} from '../../store/slices/vcSlice';
import { APP_TYPE_LABELS, formatDate, formatDistanceToNow } from '../../utils/helpers';
import StatCard from '../../components/common/StatCard';
import SectionHeader from '../../components/common/SectionHeader';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import PageHeader from '../../components/common/PageHeader';

const DEPT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0e1f38',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: '12px',
  },
};

const UrgentRow = ({ app, idx }) => (
  <div
    className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 animate-fade-in"
    style={{ animationDelay: `${idx * 30}ms` }}
  >
    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-blue-500">{app.applicationId}</span>
        <span className="text-gray-900 dark:text-white text-sm truncate font-medium">{app.title}</span>
      </div>
      <p className="text-gray-500 dark:text-slate-400 text-xs mt-0.5">
        {app.student?.firstName} {app.student?.lastName}
        {app.department?.name ? ` · ${app.department.name}` : ''}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <Clock className="w-3 h-3 text-gray-400 dark:text-slate-600" />
        <span className="text-gray-400 dark:text-slate-500 text-xs">Waiting {formatDistanceToNow(app.submittedDate)}</span>
        {app.currentRecipient && (
          <><span className="text-gray-300 dark:text-slate-700">·</span>
          <span className="text-gray-400 dark:text-slate-500 text-xs">
            With {app.currentRecipient.firstName} ({app.currentRecipient.role?.replace('_', ' ')})
          </span></>
        )}
      </div>
    </div>
  </div>
);

const StaffRow = ({ s }) => {
  const isHOD   = s.role === 'hod';
  const isChair = s.role === 'chairperson';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${
      isHOD   ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20' :
      isChair ? 'bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20' :
                'bg-gray-50 dark:bg-obsidian-800/40 border-gray-100 dark:border-white/5'
    }`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold border ${
        isHOD   ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400' :
        isChair ? 'bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400' :
                  'bg-blue-500/15 border-blue-500/25 text-blue-500'
      }`}>
        {s.profilePictureUrl
          ? <img src={s.profilePictureUrl} alt="" className="w-full h-full object-cover rounded-xl" />
          : `${s.firstName?.[0]}${s.lastName?.[0]}`}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-gray-900 dark:text-white text-sm font-medium">{s.firstName} {s.lastName}</p>
          {isHOD && (
            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 rounded-full px-1.5 py-0.5 flex items-center gap-1">
              <Crown className="w-2.5 h-2.5" /> HOD
            </span>
          )}
          {isChair && (
            <span className="text-[10px] bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25 rounded-full px-1.5 py-0.5">Chair</span>
          )}
        </div>
        <p className="text-gray-400 dark:text-slate-500 text-xs capitalize">
          {s.role?.replace('_', ' ')}{s.staffType ? ` · ${s.staffType.replace('_', ' ')}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 text-xs flex-shrink-0">
        <div className="text-center">
          <p className={`font-bold ${s.pendingCount > 0 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>{s.pendingCount}</p>
          <p className="text-gray-400 dark:text-slate-500">Pending</p>
        </div>
        {s.urgentCount > 0 && (
          <div className="text-center">
            <p className="font-bold text-red-500">{s.urgentCount}</p>
            <p className="text-gray-400 dark:text-slate-500">Urgent</p>
          </div>
        )}
      </div>
    </div>
  );
};

const DeptCard = ({ dept, color, idx, onClick }) => {
  const pct = dept.total > 0 ? Math.round((dept.pending / dept.total) * 100) : 0;
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-obsidian-800/30 hover:bg-gray-100 dark:hover:bg-obsidian-800/30 transition-all cursor-pointer group border border-transparent hover:border-gray-200 dark:hover:border-white/5/40 animate-fade-in"
      style={{ animationDelay: `${idx * 35}ms` }}
      onClick={() => onClick(dept)}
    >
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 dark:text-white text-sm font-semibold truncate">{dept.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-gray-400 dark:text-slate-500 text-xs font-mono">{dept.code}</p>
          {dept.hod && <span className="text-gray-400 dark:text-slate-600 text-xs">· HOD: {dept.hod.firstName} {dept.hod.lastName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 text-xs">
        <div className="text-center">
          <p className="text-gray-900 dark:text-white font-semibold">{dept.total}</p>
          <p className="text-gray-400 dark:text-slate-500">Total</p>
        </div>
        <div className="text-center">
          <p className={`font-semibold ${dept.pending > 0 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>{dept.pending}</p>
          <p className="text-gray-400 dark:text-slate-500">Pending</p>
        </div>
        <div className="text-center">
          <p className={`font-semibold ${dept.urgent > 0 ? 'text-red-500' : 'text-gray-400 dark:text-slate-500'}`}>{dept.urgent}</p>
          <p className="text-gray-400 dark:text-slate-500">Urgent</p>
        </div>
      </div>
      <div className="w-16 flex-shrink-0">
        <div className="h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#10b981' }} />
        </div>
        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 text-right">{pct}%</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </div>
  );
};

function UniversityOverview({ dispatch, onDeptClick }) {
  const totals       = useSelector(selectVCTotals);
  const byDept       = useSelector(selectVCByDepartment);
  const byType       = useSelector(selectVCByType);
  const urgent       = useSelector(selectVCUrgentPending);
  const recent       = useSelector(selectVCRecentApplications);
  const examWorkload = useSelector(selectVCExamOfficerWorkload);
  const myPending    = useSelector(selectVCMyPendingCount);
  const loading      = useSelector(selectVCUniversityLoading);
  const error        = useSelector(selectVCError);

  useEffect(() => { dispatch(fetchVCUniversity()); }, [dispatch]);

  const pieSafeData = [
    { name: 'Pending',   value: totals.pending,   color: '#f59e0b' },
    { name: 'Approved',  value: totals.approved,  color: '#10b981' },
    { name: 'Rejected',  value: totals.rejected,  color: '#ef4444' },
    { name: 'Completed', value: totals.completed, color: '#6b7280' },
  ].filter(d => d.value > 0);

  const barData = byDept.slice(0, 8).map(d => ({
    name: d.code || d.name?.slice(0, 6), pending: d.pending, approved: d.approved,
  }));
  const typeBarData = byType.map(t => ({
    name: APP_TYPE_LABELS?.[t._id] || t._id?.replace(/_/g, ' '), count: t.count,
  }));

  if (loading && !totals.total && !byDept.length) return <LoadingSpinner />;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 card p-8 text-center">
      <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-gray-900 dark:text-white font-semibold">Failed to load</p>
      <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{error}</p>
      <button onClick={() => dispatch(fetchVCUniversity())} className="btn-primary mt-4">Retry</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total"          value={totals.total}    icon={FileText}      colorClass="bg-blue-500/15 text-blue-500" />
        <StatCard label="Pending"        value={totals.pending}  icon={Clock}         colorClass="bg-amber-500/15 text-amber-500" sub="Awaiting action" />
        <StatCard label="Approved"       value={totals.approved} icon={CheckCircle}   colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Urgent Pending" value={totals.urgent}   icon={AlertTriangle} colorClass="bg-red-500/15 text-red-500" urgent={totals.urgent > 0} />
        <StatCard label="Assigned to Me" value={myPending}       icon={CheckCircle}   colorClass="bg-purple-500/15 text-purple-500" sub="In my queue" />
      </div>

      {(barData.length > 0 || pieSafeData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" /> Pending by Department
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="pending"  fill="#f59e0b" radius={[4,4,0,0]} name="Pending" />
                <Bar dataKey="approved" fill="#10b981" radius={[4,4,0,0]} name="Approved" opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" /> Status Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieSafeData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieSafeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {typeBarData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" /> By Application Type
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={typeBarData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip {...CHART_TOOLTIP} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {examWorkload.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={BookOpen} title="Examination Officers" count={`${examWorkload.length} officer${examWorkload.length !== 1 ? 's' : ''}`} colorClass="text-orange-500" />
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {examWorkload.map(officer => (
              <div key={officer._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-obsidian-800/40 border border-orange-200 dark:border-orange-500/20">
                <div className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-500/15 border border-orange-200 dark:border-orange-500/25 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-500 text-xs font-bold">{officer.firstName?.[0]}{officer.lastName?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-sm font-medium">{officer.firstName} {officer.lastName}</p>
                  <p className="text-orange-500 text-xs">Examination Officer</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${officer.pendingCount > 0 ? 'text-amber-500' : 'text-gray-400 dark:text-slate-500'}`}>{officer.pendingCount}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs">pending</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {byDept.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Building2} title="All Departments" count={`${byDept.length} departments — click to drill down`} />
          <div className="p-4 space-y-2">
            {byDept.map((dept, idx) => (
              <DeptCard key={dept.departmentId?.toString() || idx} dept={dept} color={DEPT_COLORS[idx % DEPT_COLORS.length]} idx={idx} onClick={onDeptClick} />
            ))}
          </div>
        </div>
      )}

      {urgent.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Urgent — Pending University-Wide
            </h3>
            <span className="text-red-400 text-xs">{urgent.length}</span>
          </div>
          <div className="p-4 space-y-2">
            {urgent.map((app, idx) => <UrgentRow key={app._id} app={app} idx={idx} />)}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Activity} title="Recent Applications" count="Latest 10" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-obsidian-850/60 border-b border-gray-100 dark:border-white/5/60">
                  {['ID','Title','Student','Department','With','Date','Status'].map(h => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {recent.map(app => (
                  <tr key={app._id} className="table-row">
                    <td className="table-cell"><span className="font-mono text-xs text-blue-500">{app.applicationId}</span></td>
                    <td className="table-cell max-w-[140px]">
                      <p className="font-medium truncate">{app.title}</p>
                      {app.isUrgent && <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-500 border border-red-200 dark:border-red-500/25 rounded-full px-1.5 py-0.5">URGENT</span>}
                    </td>
                    <td className="table-cell text-xs">{app.student?.firstName} {app.student?.lastName}</td>
                    <td className="table-cell text-xs text-gray-500 dark:text-slate-400">{app.department?.name || '—'}</td>
                    <td className="table-cell text-xs text-gray-500 dark:text-slate-400">{app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—'}</td>
                    <td className="table-cell text-xs text-gray-400 dark:text-slate-500">{formatDate(app.submittedDate)}</td>
                    <td className="table-cell"><StatusBadge status={app.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentDrillDown({ dispatch, dept, onBack }) {
  const selected = useSelector(selectVCSelectedDepartment);
  const loading  = useSelector(selectVCDepartmentLoading);
  const error    = useSelector(selectVCError);

  useEffect(() => {
    if (dept?.departmentId) dispatch(fetchVCDepartment(dept.departmentId));
  }, [dept, dispatch]);

  if (loading) return <LoadingSpinner />;
  if (error) return (
    <div className="max-w-lg mx-auto mt-16 card p-8 text-center">
      <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-gray-900 dark:text-white font-semibold">Failed to load department</p>
      <button onClick={() => dept?.departmentId && dispatch(fetchVCDepartment(dept.departmentId))} className="btn-primary mt-4">Retry</button>
    </div>
  );
  if (!selected) return null;

  const { department, studentCount, stats, staffWithWorkload = [], recentApplications, urgentPending } = selected;
  const hodEntry     = staffWithWorkload.find(s => s.role === 'hod');
  const chairEntry   = staffWithWorkload.find(s => s.role === 'chairperson');
  const regularStaff = staffWithWorkload.filter(s => s.role === 'staff');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to University
        </button>
        <div className="h-4 w-px bg-gray-200 dark:bg-obsidian-800/60" />
        <div>
          <p className="text-gray-900 dark:text-white font-semibold">{department?.name}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-mono">{department?.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total"    value={stats?.total}    icon={FileText}      colorClass="bg-blue-500/15 text-blue-500" />
        <StatCard label="Pending"  value={stats?.pending}  icon={Clock}         colorClass="bg-amber-500/15 text-amber-500" />
        <StatCard label="Approved" value={stats?.approved} icon={CheckCircle}   colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Urgent"   value={stats?.urgent}   icon={AlertTriangle} colorClass="bg-red-500/15 text-red-500" urgent={stats?.urgent > 0} />
        <StatCard label="Students" value={studentCount}    icon={Users}         colorClass="bg-blue-500/15 text-blue-500" />
      </div>

      {stats?.avgProcessingDays != null && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Zap className="w-4 h-4 text-amber-500" />
          Avg processing time: <span className="text-gray-900 dark:text-white font-semibold">{stats.avgProcessingDays.toFixed(1)} days</span>
        </div>
      )}

      {staffWithWorkload.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Users} title="Department Staff" count={`${staffWithWorkload.length} members`} />
          <div className="p-4 space-y-2">
            {hodEntry   && <StaffRow s={hodEntry} />}
            {!hodEntry  && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-obsidian-800/20 border border-dashed border-gray-200 dark:border-white/5">
                <Crown className="w-4 h-4 text-gray-400 dark:text-slate-600" />
                <p className="text-gray-400 dark:text-slate-500 text-sm">No HOD assigned</p>
              </div>
            )}
            {chairEntry && <StaffRow s={chairEntry} />}
            {regularStaff.map((s, idx) => <StaffRow key={s._id || idx} s={s} />)}
          </div>
        </div>
      )}

      {urgentPending?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-red-100 dark:border-red-500/20 bg-red-50/50 dark:bg-red-500/5">
            <h3 className="text-xs font-semibold text-red-500 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Urgent in This Department
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {urgentPending.map((app, idx) => <UrgentRow key={app._id} app={app} idx={idx} />)}
          </div>
        </div>
      )}

      {recentApplications?.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Activity} title="Recent Applications" count="Latest 10" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-obsidian-850/60 border-b border-gray-100 dark:border-white/5/60">
                  {['ID','Title','Student','With','Date','Status'].map(h => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {recentApplications.map(app => (
                  <tr key={app._id} className="table-row">
                    <td className="table-cell"><span className="font-mono text-xs text-blue-500">{app.applicationId}</span></td>
                    <td className="table-cell max-w-[140px]">
                      <p className="font-medium truncate">{app.title}</p>
                      {app.isUrgent && <span className="text-[10px] bg-red-50 dark:bg-red-500/15 text-red-500 border border-red-200 dark:border-red-500/25 rounded-full px-1.5 py-0.5">URGENT</span>}
                    </td>
                    <td className="table-cell text-xs">{app.student?.firstName} {app.student?.lastName}</td>
                    <td className="table-cell text-xs text-gray-500 dark:text-slate-400">{app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—'}</td>
                    <td className="table-cell text-xs text-gray-400 dark:text-slate-500">{formatDate(app.submittedDate)}</td>
                    <td className="table-cell"><StatusBadge status={app.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VCUniversityPage() {
  const dispatch = useDispatch();
  const [drillDept, setDrillDept] = useState(null);

  const handleDeptClick = (dept) => setDrillDept(dept);
  const handleBack = () => {
    setDrillDept(null);
    dispatch(clearSelectedDepartment());
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={drillDept ? drillDept.name : 'University Overview'}
        subtitle={drillDept ? `Department detail — ${drillDept.code}` : 'University-wide application overview'}
        icon={drillDept ? Building2 : Globe}
        iconColor="text-blue-500"
        actions={
          <button
            onClick={() => { if (drillDept) { handleBack(); } else { dispatch(fetchVCUniversity()); } }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            {drillDept ? 'Back to Overview' : 'Refresh'}
          </button>
        }
      />

      {drillDept
        ? <DepartmentDrillDown dispatch={dispatch} dept={drillDept} onBack={handleBack} />
        : <UniversityOverview dispatch={dispatch} onDeptClick={handleDeptClick} />
      }
    </div>
  );
}
