import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, StatusBadge, PriorityBadge, Spinner, ErrorNote } from '../components/ui';

const STATUSES = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'];
const CATEGORIES = ['ELECTRICAL', 'PLUMBING', 'INTERNET', 'MESS', 'CLEANLINESS', 'FURNITURE', 'SECURITY', 'OTHER'];

export default function StaffQueue({ embedded = false }) {
  const [filters, setFilters] = useState({ status: '', category: '', q: '', page: 1 });

  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.category) params.set('category', filters.category);
  if (filters.q) params.set('q', filters.q);
  params.set('page', filters.page);

  const list = useQuery({
    queryKey: ['complaints', filters],
    queryFn: () => api(`/api/complaints?${params.toString()}`),
    refetchInterval: embedded ? false : 30000,
  });

  const stats = useQuery({ queryKey: ['stats'], queryFn: () => api('/api/stats/dashboard'), enabled: embedded });

  return (
    <div className="space-y-4">
      {!embedded && <h1 className="text-xl font-bold">Complaint queue</h1>}

      {embedded && stats.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Open" value={stats.data.byStatus.OPEN || 0} color="text-sky-600" />
          <StatCard label="In progress" value={stats.data.byStatus.IN_PROGRESS || 0} color="text-amber-600" />
          <StatCard label="Urgent active" value={stats.data.urgentOpen || 0} color="text-red-600" />
          <StatCard label="Pending approvals" value={stats.data.pendingApprovals || 0} color="text-slate-700" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          {STATUSES.map((s) => <option key={s || 'all'} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value, page: 1 })}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input
          placeholder="Search title / code…"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value, page: 1 })}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      {list.isLoading && <Spinner />}
      <ErrorNote error={list.error} />

      {list.data && (
        <>
          <div className="space-y-2">
            {list.data.complaints.map((c) => (
              <Link key={c.id} to={`/complaints/${c.id}`}>
                <Card className="flex items-center gap-3 py-3 transition hover:border-indigo-300">
                  <span className="hidden font-mono text-xs text-slate-400 sm:block">{c.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.title}</p>
                    <p className="text-xs text-slate-400">
                      {c.createdBy.name}{c.createdBy.roomNumber ? ` · ${c.createdBy.hostel || ''} ${c.createdBy.roomNumber}` : ''}
                      {c.assignedTo ? ` → ${c.assignedTo.name}` : ''}
                    </p>
                  </div>
                  <PriorityBadge priority={c.priority} />
                  <StatusBadge status={c.status} />
                </Card>
              </Link>
            ))}
            {list.data.complaints.length === 0 && (
              <Card className="py-10 text-center text-sm text-slate-400">No complaints match these filters.</Card>
            )}
          </div>

          <Pagination meta={list.data.meta} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <Card className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  );
}

function Pagination({ meta, onPage }) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <button disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">← Prev</button>
      <span className="text-slate-500">Page {meta.page} of {meta.totalPages}</span>
      <button disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">Next →</button>
    </div>
  );
}
