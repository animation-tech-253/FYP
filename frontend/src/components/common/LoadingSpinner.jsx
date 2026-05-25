export default function LoadingSpinner({ fullPage = true, color = 'border-t-blue-500' }) {
  const spinner = (
    <div className={`w-9 h-9 border-2 border-slate-200 dark:border-white/5 ${color} rounded-full animate-spin`} />
  );

  if (!fullPage) {
    return <div className="flex items-center justify-center py-16">{spinner}</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      {spinner}
    </div>
  );
}
