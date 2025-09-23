import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, Spinner, ErrorNote } from '../components/ui';

export default function UsersAdmin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('list');
  const [copied, setCopied] = useState(null);

  const users = useQuery({ queryKey: ['all-users'], queryFn: () => api('/api/users') });

  const staffCreate = useMutation({
    mutationFn: (body) => api('/api/users/staff', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const bulkInvite = useMutation({
    mutationFn: (rows) => api('/api/invites/bulk', { method: 'POST', body: { rows } }),
    onSuccess: () => setTab('bulk'),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => api(`/api/users/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const suspend = useMutation({
    mutationFn: ({ id, action }) => api(`/api/users/${id}/status`, { method: 'PATCH', body: { action } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold">Users & Invites</h1>

      <div className="flex gap-2">
        {[['list', 'All users'], ['staff', 'Create warden/admin'], ['bulk', 'Bulk invite students']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <ErrorNote error={users.error || staffCreate.error || bulkInvite.error || changeRole.error || suspend.error} />

      {tab === 'list' && (users.isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {users.data?.users.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                <p className="truncate text-xs text-slate-400">{u.email} · {u.status.toLowerCase()}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
              >
                {['STUDENT', 'WARDEN', 'ADMIN'].map((r) => <option key={r}>{r}</option>)}
              </select>
              {u.role !== 'ADMIN' && (
                u.status === 'SUSPENDED' ? (
                  <button onClick={() => suspend.mutate({ id: u.id, action: 'REACTIVATE' })} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">Reactivate</button>
                ) : (
                  <button onClick={() => suspend.mutate({ id: u.id, action: 'SUSPEND' })} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100">Suspend</button>
                )
              )}
            </Card>
          ))}
        </div>
      ))}

      {tab === 'staff' && <StaffForm create={staffCreate} />}

      {tab === 'bulk' && <BulkInvites bulkInvite={bulkInvite} copied={copied} setCopied={setCopied} />}
    </div>
  );
}

function StaffForm({ create }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'WARDEN' });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const done = create.isSuccess;

  return (
    <Card className="max-w-md space-y-3">
      {done && <p className="text-sm text-emerald-700">Account created — share the password securely.</p>}
      <input placeholder="Full name" value={form.name} onChange={set('name')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input type="email" placeholder="Email" value={form.email} onChange={set('email')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <input type="password" placeholder="Initial password" value={form.password} onChange={set('password')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <select value={form.role} onChange={set('role')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
        <option>WARDEN</option><option>ADMIN</option>
      </select>
      <button
        onClick={() => create.mutate(form)}
        disabled={!form.name || !form.email || form.password.length < 8 || create.isPending}
        className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        Create account
      </button>
    </Card>
  );
}

function BulkInvites({ bulkInvite, copied, setCopied }) {
  const [csv, setCsv] = useState('');
  const results = bulkInvite.data?.results || [];
  const okRows = results.filter((r) => r.ok);

  const parseAndSend = () => {
    const rows = csv
      .split('\n')
      .map((line) => line.split(',').map((c) => c.trim()))
      .filter((cells) => cells.length >= 2 && cells[1].includes('@'))
      .map(([name, email, hostel, roomNumber]) => ({
        name,
        email,
        hostel: hostel || undefined,
        roomNumber: roomNumber || undefined,
      }));
    if (rows.length) bulkInvite.mutate(rows);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(okRows.map((r) => r.url).join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="space-y-3">
      <p className="text-xs text-slate-500">
        One per line: <code className="rounded bg-slate-100 px-1">name, email, hostel, room</code> — hostel &amp; room optional.
      </p>
      <textarea
        rows={7}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={'Aarav Sharma, aarav@college.edu, Block A, A-101\nMeera Iyer, meera@college.edu, Girls Hostel, G-304'}
        className="w-full resize-none rounded-lg border border-slate-300 p-3 font-mono text-xs"
      />
      <button
        onClick={parseAndSend}
        disabled={!csv.trim() || bulkInvite.isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {bulkInvite.isPending ? 'Generating…' : `Generate ${csv.split('\n').filter((l) => l.includes('@')).length || ''} invites`}
      </button>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r) => (
            <p key={r.email} className={`text-xs ${r.ok ? 'text-slate-700' : 'text-rose-600'}`}>
              {r.ok ? r.url : `${r.email}: ${r.reason}`}
            </p>
          ))}
          {okRows.length > 0 && (
            <button onClick={copyAll} className="mt-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">
              {copied ? 'Copied ✓' : `Copy all ${okRows.length} links`}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
