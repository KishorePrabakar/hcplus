import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../api/client';
import { Card, Spinner, ErrorNote } from '../components/ui';

export default function Approvals() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState(null);

  const pending = useQuery({
    queryKey: ['pending-users'],
    queryFn: () => api('/api/users?status=PENDING'),
    refetchInterval: 20000,
  });

  const act = useMutation({
    mutationFn: ({ id, action }) => api(`/api/users/${id}/status`, { method: 'PATCH', body: { action } }),
    onSuccess: async (data) => {
      setMsg(data.deleted ? 'Signup rejected and removed.' : 'Account approved.');
      await qc.invalidateQueries({ queryKey: ['pending-users'] });
      await qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">Pending signups</h1>

      {pending.isLoading && <Spinner />}
      {act.isSuccess && msg && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>
      )}
      <ErrorNote error={pending.error || act.error} />

      <div className="space-y-2">
        {pending.data?.users.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{u.name}</p>
              <p className="truncate text-xs text-slate-400">
                {u.email}{u.hostel ? ` · ${u.hostel}` : ''}{u.roomNumber ? ` ${u.roomNumber}` : ''}
              </p>
            </div>
            <button
              onClick={() => act.mutate({ id: u.id, action: 'APPROVE' })}
              disabled={act.isPending}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              onClick={() => act.mutate({ id: u.id, action: 'REJECT' })}
              disabled={act.isPending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Reject
            </button>
          </Card>
        ))}
        {pending.data?.users.length === 0 && (
          <Card className="py-10 text-center text-sm text-slate-400">No pending signups. All caught up ✨</Card>
        )}
      </div>
    </div>
  );
}
