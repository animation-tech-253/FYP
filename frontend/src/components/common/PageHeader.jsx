export default function PageHeader({ title, subtitle, icon: Icon, iconColor = 'text-blue-500', actions }) {
  return (
    <div className="flex items-start justify-between gap-4 animate-fade-in">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-obsidian-800/60/70 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className={`w-4.5 h-4.5 w-[18px] h-[18px] ${iconColor}`} />
          </div>
        )}
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          {actions}
        </div>
      )}
    </div>
  );
}
