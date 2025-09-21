import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, StatusBadge, PriorityBadge, Spinner, ErrorNote } from '../components/ui';

export default function StudentDashboard() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api('/api/stats/dashboard') });

  const total = stats.data ? Object.values(stats.data.byStatus).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My complaints</h1>
        <Link
          to="/complaints/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          + New complaint
        </Link>
      </div>

      {stats.isLoading && <Spinner />}
      <ErrorNote error={stats.error} />

      {stats.data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="text-center"><p className="text-2xl font-bold">{total}</p><p className="text-xs text-slate-500">Total filed</p></Card>
            <Card className="text-center"><p className="text-2xl font-bold text-sky-600">{stats.data.byStatus.OPEN || 0}</p><p className="text-xs text-slate-500">Open</p></Card>
            <Card className="text-center"><p className="text-2xl font-bold text-amber-600">{stats.data.byStatus.IN_PROGRESS || 0}</p><p className="text-xs text-slate-500">In progress</p></Card>
            <Card className="text-center"><p className="text-2xl font-bold text-emerald-600">{(stats.data.byStatus.RESOLVED || 0) + (stats.data.byStatus.CLOSED || 0)}</p><p className="text-xs text-slate-500">Resolved / done</p></Card>
          </div>

          <div className="space-y-2">
            {stats.data.recent?.length === 0 && (
              <Card className="py-10 text-center text-sm text-slate-400">
                Nothing yet. File your first complaint with the button above.
              </Card>
            )}
            {stats.data.recent?.map((c) => (
              <Link key={c.id} to={`/complaints/${c.id}`}>
                <Card className="flex items-center gap-3 py-3 transition hover:border-indigo-300">
                  <span className="font-mono text-xs text-slate-400">{c.code}</span>
                  <span className="flex-1 truncate text-sm font-medium">{c.title}</span>
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
