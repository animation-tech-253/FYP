// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BarChart3, FileText, CheckCircle, AlertTriangle, Clock,
  Building2, TrendingUp, RefreshCw, Activity, Users,
  XCircle, Globe, Shield, ChevronRight, ArrowLeft,
  Zap, UserCheck, Crown, BookOpen,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  fetchAdminOverview, fetchAdminNoDeptRoles, fetchAdminDepartment,
  selectAdminTotals, selectAdminByDepartment, selectAdminByType,
  selectAdminByStatus, selectAdminUrgentPending, selectAdminRecentApplications,
  selectAdminUserStats, selectAdminVCWorkload, selectAdminExamOfficers,
  selectAdminOverviewLoading, selectAdminLastFetched,
  selectAdminVCList, selectAdminExamOfficerList, selectAdminNoDeptLoading,
  selectAdminSelectedDepartment, selectAdminDepartmentLoading,
  clearSelectedDepartment, selectAdminError,
} from '../../store/slices/AdminSlice';
import { STATUS_STYLES, APP_TYPE_LABELS, formatDate, formatDistanceToNow } from '../../utils/helpers';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEPT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

const ROLE_COLORS_MAP = {
  student:             'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
  staff:               'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
  hod:                 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  chairperson:         'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  examination_officer: 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
  vc:                  'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/30',
  admin:               'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
};

const ROLE_DISPLAY = {
  student: 'Students', staff: 'Staff', hod: 'HODs',
  chairperson: 'Chairpersons', examination_officer: 'Exam Officers',
  vc: 'Vice Chancellor', admin: 'Admins',
};

// ── Shared primitives ─────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, colorClass, sub, urgent }) => (
  <div className={`stat-card card-hover ${urgent ? 'ring-1 ring-red-500/40' : ''}`}>
    <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center mb-3`}>
      <Icon className="w-5 h-5" />
    </div>
    <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
    <p className="text-gray-600 dark:text-slate-400 text-sm mt-0.5">{label}</p>
    {sub && <p className="text-gray-500 dark:text-slate-500 text-xs mt-0.5">{sub}</p>}
  </div>
);

const SectionHeader = ({ icon: Icon, title, count, colorClass = 'text-indigo-500 dark:text-indigo-400' }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/5">
    <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
      <Icon className={`w-4 h-4 ${colorClass}`} />
      {title}
    </h3>
    {count !== undefined && <span className="text-gray-500 dark:text-slate-500 text-xs">{count}</span>}
  </div>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-10 h-10 border-2 border-gray-200 dark:border-white/5 border-t-indigo-500 rounded-full animate-spin" />
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="max-w-lg mx-auto mt-20 card p-8 text-center">
    <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
    <p className="text-gray-900 dark:text-white font-semibold">Failed to load</p>
    <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{message}</p>
    <button onClick={onRetry} className="btn-primary mt-4">Retry</button>
  </div>
);

const UrgentRow = ({ app, idx }) => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{app.applicationId}</span>
        <span className="text-gray-900 dark:text-white text-sm truncate">{app.title}</span>
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
          <span className="text-gray-400 dark:text-slate-500 text-xs">With {app.currentRecipient.firstName} ({app.currentRecipient.role?.replace('_', ' ')})</span></>
        )}
      </div>
    </div>
  </div>
);

const DeptCard = ({ dept, color, idx, onClick }) => {
  const pct = dept.total > 0 ? Math.round((dept.pending / dept.total) * 100) : 0;
  return (
    <div
      className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-obsidian-800/30 hover:bg-gray-200 dark:hover:bg-gray-100 dark:bg-obsidian-800/60 transition-all cursor-pointer group border border-transparent hover:border-gray-200 dark:border-white/5 animate-fade-in"
      style={{ animationDelay: `${idx * 35}ms` }}
      onClick={() => onClick(dept)}
    >
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{dept.name}</p>
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
          <p className={`font-semibold ${dept.pending > 0 ? 'text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>{dept.pending}</p>
          <p className="text-gray-400 dark:text-slate-500">Pending</p>
        </div>
        <div className="text-center">
          <p className={`font-semibold ${dept.urgent > 0 ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{dept.urgent}</p>
          <p className="text-gray-400 dark:text-slate-500">Urgent</p>
        </div>
      </div>
      <div className="w-16 flex-shrink-0">
        <div className="h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct > 60 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#10b981' }} />
        </div>
        <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-0.5 text-right">{pct}%</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-600 group-hover:text-gray-500 dark:text-slate-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </div>
  );
};

// Role priority card (VC or ExamOfficer in overview)
const NoDeptRoleCard = ({ user, accentClass, accentText, onClick }) => (
  <div
    className={`flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-obsidian-800/40 border ${accentClass} hover:bg-gray-200 dark:hover:bg-gray-200 dark:bg-obsidian-800/60 cursor-pointer transition-all group`}
    onClick={onClick}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border ${accentClass}`}>
      <span className={`text-sm font-bold ${accentText}`}>
        {user.firstName?.[0]}{user.lastName?.[0]}
      </span>
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-gray-900 dark:text-white text-sm font-medium">{user.firstName} {user.lastName}</p>
      <p className={`text-xs ${accentText}`}>{user.role === 'vc' ? 'Vice Chancellor' : 'Examination Officer'}</p>
    </div>
    <div className="text-right flex-shrink-0">
      <p className={`text-sm font-bold ${user.pendingCount > 0 ? 'text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>{user.pendingCount}</p>
      <p className="text-gray-400 dark:text-slate-500 text-xs">pending</p>
    </div>
    {user.urgentCount > 0 && (
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-red-400">{user.urgentCount}</p>
        <p className="text-gray-400 dark:text-slate-500 text-xs">urgent</p>
      </div>
    )}
    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-600 group-hover:text-gray-500 dark:text-slate-400 flex-shrink-0 transition-colors" />
  </div>
);

// Staff row in department drill — HOD gets special treatment
const StaffRow = ({ s, isHOD, isChairperson }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
    isHOD         ? 'bg-emerald-500/5 border-emerald-500/20' :
    isChairperson ? 'bg-amber-500/5 border-amber-500/20' :
                    'bg-gray-100 dark:bg-obsidian-800/40 border-gray-100 dark:border-white/5'
  }`}>
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border text-xs font-bold ${
      isHOD         ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
      isChairperson ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' :
                      'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
    }`}>
      {s.profilePictureUrl
        ? <img src={s.profilePictureUrl} alt="" className="w-full h-full object-cover rounded-xl" />
        : `${s.firstName?.[0]}${s.lastName?.[0]}`
      }
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-gray-900 dark:text-white text-sm font-medium">{s.firstName} {s.lastName}</p>
        {isHOD && (
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded px-1.5 py-0.5 flex items-center gap-1">
            <Crown className="w-2.5 h-2.5" /> HOD
          </span>
        )}
        {isChairperson && (
          <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1.5 py-0.5">Chair</span>
        )}
      </div>
      <p className="text-gray-400 dark:text-slate-500 text-xs capitalize">
        {s.role?.replace('_', ' ')}
        {s.staffType ? ` · ${s.staffType.replace('_', ' ')}` : ''}
        {s.email ? ` · ${s.email}` : ''}
      </p>
    </div>
    <div className="flex items-center gap-3 text-xs flex-shrink-0">
      <div className="text-center">
        <p className={`font-bold ${s.pendingCount > 0 ? 'text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>{s.pendingCount}</p>
        <p className="text-gray-400 dark:text-slate-500">Pending</p>
      </div>
      {s.urgentCount > 0 && (
        <div className="text-center">
          <p className="font-bold text-red-400">{s.urgentCount}</p>
          <p className="text-gray-400 dark:text-slate-500">Urgent</p>
        </div>
      )}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: SYSTEM OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab({ dispatch, onDeptClick, onNoDeptClick }) {
  const totals      = useSelector(selectAdminTotals);
  const byDept      = useSelector(selectAdminByDepartment);
  const byType      = useSelector(selectAdminByType);
  const byStatus    = useSelector(selectAdminByStatus);
  const urgent      = useSelector(selectAdminUrgentPending);
  const recent      = useSelector(selectAdminRecentApplications);
  const userStats   = useSelector(selectAdminUserStats);
  const vcWorkload  = useSelector(selectAdminVCWorkload);
  const examOfficers= useSelector(selectAdminExamOfficers);
  const loading     = useSelector(selectAdminOverviewLoading);
  const lastFetched = useSelector(selectAdminLastFetched);
  const error       = useSelector(selectAdminError);

  useEffect(() => { dispatch(fetchAdminOverview()); }, [dispatch]);

  const pieSafeData = byStatus.map(s => ({
    name:  s._id?.replace(/_/g, ' '),
    value: s.count,
    color: { pending:'#f59e0b', forwarded:'#8b5cf6', approved:'#10b981', rejected:'#ef4444', completed:'#6b7280', under_review:'#3b82f6' }[s._id] || '#6b7280',
  })).filter(d => d.value > 0);

  const barData = byDept.slice(0, 8).map(d => ({
    name: d.code || d.name?.slice(0, 6), pending: d.pending, approved: d.approved,
  }));

  const typeBarData = byType.map(t => ({
    name: APP_TYPE_LABELS?.[t._id] || t._id?.replace(/_/g, ' '), count: t.count,
  }));

  const totalUsers = userStats.reduce((acc, r) => acc + (r.count || 0), 0);

  if (loading && !totals.total && !byDept.length) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => dispatch(fetchAdminOverview())} />;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Applications" value={totals.total}    icon={FileText}      colorClass="bg-indigo-600/20 text-indigo-400" />
        <StatCard label="Pending"            value={totals.pending}  icon={Clock}         colorClass="bg-amber-500/20 text-amber-400" />
        <StatCard label="Approved"           value={totals.approved} icon={CheckCircle}   colorClass="bg-emerald-500/20 text-emerald-400" />
        <StatCard label="Urgent Pending"     value={totals.urgent}   icon={AlertTriangle} colorClass="bg-red-500/20 text-red-400" urgent={totals.urgent > 0} />
        <StatCard label="Active Users"       value={totalUsers}      icon={Users}         colorClass="bg-blue-500/20 text-blue-400" />
      </div>

      {totals.avgProcessingDays != null && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Zap className="w-4 h-4 text-yellow-400" />
          Average processing time: <span className="text-gray-900 dark:text-white font-medium">{totals.avgProcessingDays.toFixed(1)} days</span>
        </div>
      )}

      {(pieSafeData.length > 0 || barData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" /> Status Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieSafeData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieSafeData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background:'#1e1b4b', border:'1px solid #4338ca33', borderRadius:'8px', color:'#e2e8f0' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-yellow-400" /> Pending by Department
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
                <Tooltip contentStyle={{ background:'#1e1b4b', border:'1px solid #4338ca33', borderRadius:'8px', color:'#e2e8f0' }} />
                <Bar dataKey="pending"  fill="#f59e0b" radius={[4,4,0,0]} name="Pending" />
                <Bar dataKey="approved" fill="#10b981" radius={[4,4,0,0]} name="Approved" opacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {typeBarData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" /> By Application Type
          </h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={typeBarData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} />
              <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} />
              <Tooltip contentStyle={{ background:'#1e1b4b', border:'1px solid #4338ca33', borderRadius:'8px', color:'#e2e8f0' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {userStats.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Users} title="User Headcount by Role" />
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {userStats.map(r => (
              <div key={r._id} className={`flex items-center gap-2 p-3 rounded-xl border ${ROLE_COLORS_MAP[r._id] || 'bg-slate-700/20 text-gray-500 dark:text-slate-400 border-slate-700/30'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{ROLE_DISPLAY[r._id] || r._id}</p>
                </div>
                <p className="text-lg font-bold">{r.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ FIX: VC shown separately — highest priority after admin */}
      {vcWorkload.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Crown} title="Vice Chancellor" colorClass="text-yellow-600 dark:text-yellow-400" />
          <div className="p-4 space-y-2">
            {vcWorkload.map(u => (
              <NoDeptRoleCard
                key={u._id}
                user={u}
                accentClass="border-yellow-500/20"
                accentText="text-yellow-700 dark:text-yellow-400"
                onClick={() => onNoDeptClick('vc')}
              />
            ))}
          </div>
        </div>
      )}

      {/* ✅ FIX: ExamOfficers in their own separate section */}
      {examOfficers.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={BookOpen} title="Examination Officers" count={`${examOfficers.length} officer${examOfficers.length !== 1 ? 's' : ''}`} colorClass="text-orange-600 dark:text-orange-400" />
          <div className="p-4 space-y-2">
            {examOfficers.map(u => (
              <NoDeptRoleCard
                key={u._id}
                user={u}
                accentClass="border-orange-500/20"
                accentText="text-orange-700 dark:text-orange-400"
                onClick={() => onNoDeptClick('exam')}
              />
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 bg-red-500/5">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Urgent — Pending Across University
            </h3>
            <span className="text-red-500 dark:text-red-400/60 text-xs">{urgent.length}</span>
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
                <tr className="bg-gray-50 dark:bg-obsidian-800/30 border-b border-gray-200 dark:border-white/5">
                  {['ID','Title','Student','Department','With','Date','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {recent.map((app, idx) => (
                  <tr key={app._id} className="hover:bg-gray-50 dark:hover:bg-gray-50/80 dark:bg-obsidian-800/20 transition-colors" style={{ animationDelay: `${idx * 25}ms` }}>
                    <td className="px-4 py-3"><span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{app.applicationId}</span></td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <p className="text-gray-900 dark:text-white text-sm truncate">{app.title}</p>
                      {app.isUrgent && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1">URGENT</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs">{app.student?.firstName} {app.student?.lastName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{app.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{formatDate(app.submittedDate)}</td>
                    <td className="px-4 py-3"><span className={STATUS_STYLES[app.status] || STATUS_STYLES.pending}>{app.status?.replace(/_/g, ' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lastFetched && <p className="text-gray-300 dark:text-slate-700 text-xs text-right">Last updated {formatDistanceToNow(lastFetched)}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: DEPARTMENT DRILL-DOWN
// ══════════════════════════════════════════════════════════════════════════════
function DepartmentTab({ dispatch, dept, onBack }) {
  const selected = useSelector(selectAdminSelectedDepartment);
  const loading  = useSelector(selectAdminDepartmentLoading);
  const error    = useSelector(selectAdminError);

  useEffect(() => {
    if (dept?.departmentId) dispatch(fetchAdminDepartment(dept.departmentId));
  }, [dept, dispatch]);

  if (loading) return <LoadingSpinner />;
  if (error)   return <ErrorState message={error} onRetry={() => dept?.departmentId && dispatch(fetchAdminDepartment(dept.departmentId))} />;
  if (!selected) return null;

  const { department, studentCount, staffCount, stats, staffWithWorkload = [], recentApplications, urgentPending } = selected;

  const hodEntry         = staffWithWorkload.find(s => s.role === 'hod');
  const chairEntry       = staffWithWorkload.find(s => s.role === 'chairperson');
  const regularStaff     = staffWithWorkload.filter(s => s.role === 'staff');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Overview
        </button>
        <div className="h-4 w-px bg-gray-300 dark:bg-obsidian-800/60" />
        <div>
          <p className="text-gray-900 dark:text-white font-semibold">{department?.name}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs font-mono">{department?.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="Total Apps"  value={stats?.total}    icon={FileText}      colorClass="bg-indigo-600/20 text-indigo-400" />
        <StatCard label="Pending"     value={stats?.pending}  icon={Clock}         colorClass="bg-amber-500/20 text-amber-400" />
        <StatCard label="Approved"    value={stats?.approved} icon={CheckCircle}   colorClass="bg-emerald-500/20 text-emerald-400" />
        <StatCard label="Urgent"      value={stats?.urgent}   icon={AlertTriangle} colorClass="bg-red-500/20 text-red-400" urgent={stats?.urgent > 0} />
        <StatCard label="Students"    value={studentCount}    icon={Users}         colorClass="bg-blue-500/20 text-blue-400" />
        <StatCard label="Staff"       value={staffCount}      icon={UserCheck}     colorClass="bg-purple-500/20 text-purple-400" />
      </div>

      {stats?.avgProcessingDays != null && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          <Zap className="w-4 h-4 text-yellow-400" />
          Avg processing time: <span className="text-gray-900 dark:text-white font-medium">{stats.avgProcessingDays.toFixed(1)} days</span>
        </div>
      )}

      {/* ✅ FIX: Staff list — HOD always first, then chairperson, then rest */}
      {staffWithWorkload.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Users} title="Department Staff" count={`${staffWithWorkload.length} members`} />
          <div className="p-4 space-y-2">
            {/* HOD first — prominently */}
            {hodEntry && <StaffRow s={hodEntry} isHOD={true} />}
            {/* No HOD notice */}
            {!hodEntry && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-obsidian-800/20 border border-dashed border-gray-200 dark:border-white/5">
                <Crown className="w-4 h-4 text-gray-400 dark:text-slate-600" />
                <p className="text-gray-400 dark:text-slate-500 text-sm">No HOD assigned to this department</p>
              </div>
            )}
            {/* Chairperson second */}
            {chairEntry && <StaffRow s={chairEntry} isChairperson={true} />}
            {/* Regular staff */}
            {regularStaff.map((s, idx) => <StaffRow key={s._id || idx} s={s} />)}
          </div>
        </div>
      )}

      {urgentPending?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 bg-red-500/5">
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
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
                <tr className="bg-gray-50 dark:bg-obsidian-800/30 border-b border-gray-200 dark:border-white/5">
                  {['ID','Title','Student','With','Date','Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {recentApplications.map(app => (
                  <tr key={app._id} className="hover:bg-gray-50 dark:hover:bg-gray-50/80 dark:bg-obsidian-800/20 transition-colors">
                    <td className="px-4 py-3"><span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">{app.applicationId}</span></td>
                    <td className="px-4 py-3 max-w-[140px]">
                      <p className="text-gray-900 dark:text-white text-sm truncate">{app.title}</p>
                      {app.isUrgent && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1">URGENT</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-300 text-xs">{app.student?.firstName} {app.student?.lastName}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{app.currentRecipient ? `${app.currentRecipient.firstName} ${app.currentRecipient.lastName}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{formatDate(app.submittedDate)}</td>
                    <td className="px-4 py-3"><span className={STATUS_STYLES[app.status] || STATUS_STYLES.pending}>{app.status?.replace(/_/g, ' ')}</span></td>
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

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: NO-DEPT ROLES DETAIL (VC separate from ExamOfficers)
// ══════════════════════════════════════════════════════════════════════════════
function NoDeptRolesTab({ dispatch, onBack, initialFocus }) {
  const vcList      = useSelector(selectAdminVCList);
  const examList    = useSelector(selectAdminExamOfficerList);
  const loading     = useSelector(selectAdminNoDeptLoading);
  const error       = useSelector(selectAdminError);

  useEffect(() => { dispatch(fetchAdminNoDeptRoles()); }, [dispatch]);

  if (loading && !vcList.length && !examList.length) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} onRetry={() => dispatch(fetchAdminNoDeptRoles())} />;

  const renderUserDetail = ({ user, pendingApps, recentHistory, pendingCount, urgentCount }, accentClass, accentText, roleLabel) => (
    <div key={user._id} className="card overflow-hidden">
      <div className={`flex items-center gap-4 px-5 py-4 border-b ${accentClass} bg-opacity-5`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${accentClass}`}>
          <span className={`text-base font-bold ${accentText}`}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-gray-900 dark:text-white font-semibold">{user.firstName} {user.lastName}</p>
          <p className={`text-sm ${accentText}`}>{roleLabel}</p>
          <p className="text-gray-400 dark:text-slate-500 text-xs">{user.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className={`text-xl font-bold ${pendingCount > 0 ? 'text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>{pendingCount}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs">pending</p>
          </div>
          {urgentCount > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-red-400">{urgentCount}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs">urgent</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{user.stats?.applicationsAccepted ?? 0}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs">approved</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{user.stats?.applicationsRejected ?? 0}</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs">rejected</p>
          </div>
        </div>
      </div>

      {pendingApps.length > 0 ? (
        <div className="p-4 space-y-2">
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">Current Pending Queue</p>
          {pendingApps.map(app => (
            <div key={app._id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-100 dark:bg-obsidian-800/40 border border-gray-100 dark:border-white/5">
              <span className="font-mono text-xs text-indigo-400 flex-shrink-0">{app.applicationId}</span>
              <p className="text-gray-900 dark:text-white text-sm flex-1 truncate">{app.title}</p>
              <p className="text-gray-500 dark:text-slate-400 text-xs flex-shrink-0">{app.student?.firstName} {app.student?.lastName}</p>
              {app.department?.name && <p className="text-gray-400 dark:text-slate-500 text-xs flex-shrink-0">{app.department.name}</p>}
              {app.isUrgent && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded px-1.5 flex-shrink-0">URGENT</span>}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center">
          <CheckCircle className="w-8 h-8 text-emerald-600/40 mx-auto mb-2" />
          <p className="text-gray-400 dark:text-slate-500 text-sm">Inbox is clear</p>
        </div>
      )}

      {recentHistory.length > 0 && (
        <div className="border-t border-gray-200 dark:border-white/5">
          <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-5 py-3">Recent Actions</p>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {recentHistory.slice(0, 5).map((h, idx) => (
              <div key={h._id || idx} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-50/80 dark:bg-obsidian-800/20 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  h.action === 'approved' || h.action === 'verified' ? 'bg-emerald-400' :
                  h.action === 'rejected' ? 'bg-red-400' : h.action === 'forwarded' ? 'bg-purple-400' : 'bg-slate-500'
                }`} />
                <span className="font-mono text-xs text-indigo-400 flex-shrink-0">{h.application?.applicationId}</span>
                <p className="text-gray-900 dark:text-white text-sm flex-1 truncate">{h.application?.title}</p>
                <span className="text-gray-400 dark:text-slate-500 text-xs flex-shrink-0 capitalize">{h.action}</span>
                <span className="text-gray-400 dark:text-slate-600 text-xs flex-shrink-0">{formatDate(h.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Overview
        </button>
        <div className="h-4 w-px bg-gray-300 dark:bg-obsidian-800/60" />
        <p className="text-gray-900 dark:text-white font-semibold">University-wide Roles</p>
      </div>

      {/* ✅ VC Section — shown first, highest priority */}
      {vcList.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Vice Chancellor</h3>
          </div>
          {vcList.map(item => renderUserDetail(item, 'border-yellow-500/20', 'text-yellow-700 dark:text-yellow-400', 'Vice Chancellor'))}
        </div>
      )}

      {/* ✅ ExamOfficers Section — shown separately below VC */}
      {examList.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
              Examination Officers ({examList.length})
            </h3>
          </div>
          {examList.map(item => renderUserDetail(item, 'border-orange-500/20', 'text-orange-700 dark:text-orange-400', 'Examination Officer'))}
        </div>
      )}

      {vcList.length === 0 && examList.length === 0 && (
        <div className="card p-12 text-center">
          <Shield className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-slate-400">No university-wide roles found</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const dispatch   = useDispatch();
  const [activeTab,   setActiveTab]   = useState('overview');
  const [drillDept,   setDrillDept]   = useState(null);
  const [noDeptFocus, setNoDeptFocus] = useState(null); // 'vc' | 'exam'

  const handleDeptClick = (dept) => {
    setDrillDept(dept);
    setActiveTab('department');
  };

  const handleNoDeptClick = (focus) => {
    setNoDeptFocus(focus);
    setActiveTab('nodept');
  };

  const handleBackToOverview = () => {
    setDrillDept(null);
    dispatch(clearSelectedDepartment());
    setActiveTab('overview');
  };

  const handleRefresh = () => {
    if (activeTab === 'overview')   dispatch(fetchAdminOverview());
    if (activeTab === 'nodept')     dispatch(fetchAdminNoDeptRoles());
    if (activeTab === 'department' && drillDept?.departmentId) dispatch(fetchAdminDepartment(drillDept.departmentId));
  };

  const tabs = [
    { id: 'overview',   label: 'System Overview',    icon: Globe },
    { id: 'nodept',     label: 'VC & Exam Officers',  icon: Shield },
    { id: 'department', label: drillDept?.name || 'Department', icon: Building2, hidden: !drillDept },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" /> Admin Dashboard
          </h1>
          <p className="text-gray-500 dark:text-slate-400 mt-1">
            {activeTab === 'overview'   ? 'System-wide overview and analytics' :
             activeTab === 'nodept'     ? 'VC and Examination Officer queues' :
             `Department detail — ${drillDept?.name}`}
          </p>
        </div>
        <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="flex items-center gap-1 p-1 bg-gray-50 dark:bg-obsidian-850/60 rounded-xl border border-gray-200 dark:border-white/5 w-fit animate-fade-in">
        {tabs.filter(t => !t.hidden).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === 'overview' && activeTab === 'department') handleBackToOverview();
              else setActiveTab(tab.id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-indigo-100 dark:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-500/30'
                : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-obsidian-800/40'
            }`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview'   && <OverviewTab    dispatch={dispatch} onDeptClick={handleDeptClick} onNoDeptClick={handleNoDeptClick} />}
      {activeTab === 'nodept'     && <NoDeptRolesTab dispatch={dispatch} onBack={handleBackToOverview} initialFocus={noDeptFocus} />}
      {activeTab === 'department' && drillDept && <DepartmentTab dispatch={dispatch} dept={drillDept} onBack={handleBackToOverview} />}
    </div>
  );
}