const STATUS_STYLES = {
  OPEN: 'bg-sky-100 text-sky-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-600',
  REJECTED: 'bg-rose-100 text-rose-700',
};

const PRIORITY_STYLES = {
  LOW: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-1 ring-orange-300',
  URGENT: 'bg-red-600 text-white',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] || 'bg-slate-100'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${PRIORITY_STYLES[priority] || ''}`}>
      {priority}
    </span>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <div className={`animate-spin rounded-full border-2 border-indigo-600 border-t-transparent ${className}`} />;
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {error.message || 'Something went wrong'}
    </p>
  );
}
