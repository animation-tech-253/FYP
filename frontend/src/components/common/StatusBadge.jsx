// Status → color mapping uses both light and dark tokens for full mode support.
// "forwarded" uses violet to distinguish it from the blue primary accent.
const STATUS_MAP = {
  pending:      'bg-amber-50   dark:bg-amber-500/10   text-amber-700   dark:text-amber-400   border-amber-200   dark:border-amber-500/25',
  under_review: 'bg-blue-50    dark:bg-blue-500/10    text-blue-700    dark:text-blue-400    border-blue-200    dark:border-blue-500/25',
  forwarded:    'bg-violet-50  dark:bg-violet-500/10  text-violet-700  dark:text-violet-400  border-violet-200  dark:border-violet-500/25',
  approved:     'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25',
  rejected:     'bg-red-50     dark:bg-red-500/10     text-red-700     dark:text-red-400     border-red-200     dark:border-red-500/25',
  verified:     'bg-teal-50    dark:bg-teal-500/10    text-teal-700    dark:text-teal-400    border-teal-200    dark:border-teal-500/25',
  completed:    'bg-slate-100  dark:bg-slate-500/10   text-slate-600   dark:text-slate-400   border-slate-200   dark:border-slate-500/25',
};

export default function StatusBadge({ status }) {
  const cls = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${cls}`}>
      {status?.replace(/_/g, ' ') ?? 'unknown'}
    </span>
  );
}
