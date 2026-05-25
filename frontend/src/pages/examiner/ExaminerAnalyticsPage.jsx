import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  CheckCircle, Clock, GraduationCap, TrendingUp,
  BarChart3, FileText, Building2, Zap, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  fetchExaminerAnalytics,
  selectExaminerAnalytics,
  selectExaminerAnalyticsLoading,
} from '../../store/slices/applicationsSlice';
import { APP_TYPE_LABELS } from '../../utils/helpers';
import StatCard from '../../components/common/StatCard';
import SectionHeader from '../../components/common/SectionHeader';
import PageHeader from '../../components/common/PageHeader';

const APP_TYPE_COLORS = {
  result_card_request: '#6366f1',
  certificate_request: '#10b981',
  transcript_request:  '#f59e0b',
  other:               '#8b5cf6',
};

const CGPA_COLORS = {
  '< 1.5':   '#ef4444',
  '1.5–2.0': '#f97316',
  '2.0–2.5': '#f59e0b',
  '2.5–3.0': '#84cc16',
  '3.0–3.5': '#10b981',
  '3.5–4.0': '#06b6d4',
};

const CHART_TOOLTIP = {
  contentStyle: {
    background: '#0e1f38',
    border: '1px solid rgba(37,99,235,0.25)',
    borderRadius: '10px',
    color: '#e2e8f0',
    fontSize: '12px',
  },
};

export default function ExaminerAnalyticsPage() {
  const dispatch         = useDispatch();
  const analytics        = useSelector(selectExaminerAnalytics);
  const analyticsLoading = useSelector(selectExaminerAnalyticsLoading);

  useEffect(() => {
    if (!analytics && !analyticsLoading) dispatch(fetchExaminerAnalytics());
  }, [analytics, analyticsLoading, dispatch]);

  if (analyticsLoading) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader title="Analytics" subtitle="Verification trends and statistics" icon={BarChart3} iconColor="text-orange-500" />
        <div className="card p-16 text-center">
          <div className="w-10 h-10 border-2 border-gray-200 dark:border-white/5 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400 text-sm">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6 pb-8">
        <PageHeader
          title="Analytics"
          subtitle="Verification trends and statistics"
          icon={BarChart3}
          iconColor="text-orange-500"
          actions={
            <button onClick={() => dispatch(fetchExaminerAnalytics())} className="btn-secondary flex items-center gap-2 text-sm">
              <RefreshCw className="w-4 h-4" /> Load Analytics
            </button>
          }
        />
        <div className="card p-16 text-center">
          <BarChart3 className="w-10 h-10 text-gray-300 dark:text-obsidian-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-slate-300 font-medium">No analytics data yet</p>
          <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">Analytics appear once you start verifying applications</p>
        </div>
      </div>
    );
  }

  const { overview, byDepartment, byType, cgpaDistribution, monthlyTrend, attendanceStats, duesStats } = analytics;

  const typeChartData = byType.map(t => ({
    name:  APP_TYPE_LABELS?.[t._id] || t._id?.replace(/_/g, ' '),
    count: t.count,
    color: APP_TYPE_COLORS[t._id] || '#6b7280',
  }));

  const duesPie = [
    { name: 'Cleared',     value: duesStats.cleared    || 0, color: '#10b981' },
    { name: 'Not Cleared', value: duesStats.notCleared || 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const attendanceBars = [
    { name: '< 75%',  count: attendanceStats.below75  || 0 },
    { name: '75–90%', count: attendanceStats.btw75_90 || 0 },
    { name: '≥ 90%',  count: attendanceStats.above90  || 0 },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Analytics"
        subtitle="Verification trends, CGPA distribution, and department breakdown"
        icon={BarChart3}
        iconColor="text-orange-500"
        actions={
          <button onClick={() => dispatch(fetchExaminerAnalytics())} className="btn-secondary flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Verified"   value={overview.totalVerified}                                            icon={CheckCircle}   colorClass="bg-emerald-500/15 text-emerald-500" />
        <StatCard label="Avg CGPA"         value={overview.avgCgpa ?? '—'}                                           icon={GraduationCap} colorClass="bg-blue-500/15 text-blue-500" />
        <StatCard label="Avg Processing"   value={overview.avgProcessDays != null ? `${overview.avgProcessDays}d` : '—'} icon={Zap}       colorClass="bg-amber-500/15 text-amber-500" />
        <StatCard label="Pending in Queue" value={overview.totalPending}                                              icon={Clock}         colorClass="bg-purple-500/15 text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {monthlyTrend.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" /> Monthly Verifications
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={monthlyTrend} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="month" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill:'#6366f1', r:4 }} name="Verified" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {cgpaDistribution.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-500" /> CGPA Distribution
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cgpaDistribution} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <XAxis dataKey="range" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="count" radius={[4,4,0,0]} name="Students">
                  {cgpaDistribution.map((entry, i) => (
                    <Cell key={i} fill={CGPA_COLORS[entry.range] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {typeChartData.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> By Type
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={typeChartData} cx="50%" cy="50%" outerRadius={65} dataKey="count"
                  label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                  {typeChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} formatter={(v, _n, p) => [v, p.payload.name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {typeChartData.map(t => (
                <div key={t.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="text-gray-500 dark:text-slate-400 flex-1 truncate">{t.name}</span>
                  <span className="text-gray-900 dark:text-white font-semibold">{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {duesPie.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-4">Fee Dues</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={duesPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {duesPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Cleared</span>
                <span className="text-gray-900 dark:text-white font-semibold">{duesStats.cleared || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500" />Not Cleared</span>
                <span className="text-gray-900 dark:text-white font-semibold">{duesStats.notCleared || 0}</span>
              </div>
            </div>
          </div>
        )}

        {(attendanceStats.below75 > 0 || attendanceStats.btw75_90 > 0 || attendanceStats.above90 > 0) && (
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">Attendance</h3>
            {attendanceStats.avg != null && (
              <p className="text-gray-400 dark:text-slate-500 text-xs mb-3">
                Avg: <span className="text-gray-900 dark:text-white font-semibold">{attendanceStats.avg.toFixed(1)}%</span>
              </p>
            )}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={attendanceBars} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                <XAxis dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} />
                <YAxis tick={{ fill:'#94a3b8', fontSize:11 }} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="count" radius={[4,4,0,0]} name="Students">
                  <Cell fill="#ef4444" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#10b981" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {byDepartment.length > 0 && (
        <div className="card overflow-hidden">
          <SectionHeader icon={Building2} title="By Department" count={`${byDepartment.length} departments`} colorClass="text-blue-500" />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-obsidian-850/60 border-b border-gray-100 dark:border-white/5/60">
                  {['Department', 'Verified', 'Avg CGPA', 'High CGPA (≥3.0)', 'Dues Cleared', 'Share'].map(h => (
                    <th key={h} className="table-header-cell">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {byDepartment.map((dept, idx) => {
                  const highCgpaPct    = dept.total > 0 ? Math.round((dept.highCgpa    / dept.total) * 100) : 0;
                  const duesClearedPct = dept.total > 0 ? Math.round((dept.duesCleared / dept.total) * 100) : 0;
                  return (
                    <tr key={dept._id || idx} className="table-row animate-fade-in" style={{ animationDelay: `${idx * 25}ms` }}>
                      <td className="table-cell">
                        <p className="font-semibold">{dept.name}</p>
                        <p className="text-gray-400 dark:text-slate-500 text-xs font-mono">{dept.code}</p>
                      </td>
                      <td className="table-cell font-semibold">{dept.total}</td>
                      <td className="table-cell">
                        <span className={`font-bold text-sm ${dept.avgCgpa >= 3.0 ? 'text-emerald-500' : dept.avgCgpa >= 2.0 ? 'text-amber-500' : 'text-red-500'}`}>
                          {dept.avgCgpa ?? '—'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{dept.highCgpa}</span>
                          <div className="flex-1 max-w-[50px] h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${highCgpaPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{highCgpaPct}%</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{dept.duesCleared}</span>
                          <div className="flex-1 max-w-[50px] h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${duesClearedPct}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{duesClearedPct}%</span>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 dark:bg-obsidian-800/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-orange-500" style={{ width: `${(dept.total / Math.max(...byDepartment.map(d => d.total), 1)) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{dept.total}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
