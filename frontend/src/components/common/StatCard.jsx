import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function StatCard({ label, value, icon: Icon, colorClass, sub, urgent, trend }) {
  return (
    <div className={`stat-card card-hover ${urgent ? 'ring-1 ring-red-400/40 dark:ring-red-500/30' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg ${colorClass} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </div>
        {trend != null && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${
            trend > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : trend < 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}>
            {trend > 0
              ? <ArrowUpRight className="w-3 h-3" />
              : trend < 0
              ? <ArrowDownRight className="w-3 h-3" />
              : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
          {value ?? '—'}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
