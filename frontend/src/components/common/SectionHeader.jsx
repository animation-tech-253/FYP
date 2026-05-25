export default function SectionHeader({ icon: Icon, title, count, colorClass = 'text-blue-500', action }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <Icon className={`w-4 h-4 ${colorClass}`} />
        {title}
      </h3>
      <div className="flex items-center gap-3">
        {count !== undefined && (
          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{count}</span>
        )}
        {action}
      </div>
    </div>
  );
}
