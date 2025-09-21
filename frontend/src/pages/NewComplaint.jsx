import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, ErrorNote } from '../components/ui';

const CATEGORIES = [
  { value: 'ELECTRICAL', icon: '💡', label: 'Electrical' },
  { value: 'PLUMBING', icon: '🚰', label: 'Plumbing' },
  { value: 'INTERNET', icon: '📶', label: 'Internet' },
  { value: 'MESS', icon: '🍽️', label: 'Mess / Food' },
  { value: 'CLEANLINESS', icon: '🧹', label: 'Cleanliness' },
  { value: 'FURNITURE', icon: '🪑', label: 'Furniture' },
  { value: 'SECURITY', icon: '🔐', label: 'Security' },
  { value: 'OTHER', icon: '📦', label: 'Other' },
];

const PRIORITIES = [
  { value: 'LOW', hint: 'Whenever convenient' },
  { value: 'MEDIUM', hint: 'Normal fix' },
  { value: 'HIGH', hint: 'Affects daily life' },
  { value: 'URGENT', hint: 'Unsafe / cannot wait' },
];

export default function NewComplaint() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', description: '', category: '', priority: 'MEDIUM' });
  const [error, setError] = useState(null);

  const create = useMutation({
    mutationFn: (body) => api('/api/complaints', { method: 'POST', body }),
    onSuccess: async (data) => {
      await qc.invalidateQueries();
      navigate(`/complaints/${data.complaint.id}`);
    },
    onError: setError,
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.category) return;
    create.mutate(form);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">File a complaint</h1>
      <form onSubmit={submit} className="space-y-4">
        <Card>
          <label className="text-sm font-medium text-slate-700">What's it about?</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setForm({ ...form, category: c.value })}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition ${
                  form.category === c.value
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="text-xl">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3">
          <input
            required
            minLength={5}
            placeholder="Short title, e.g. 'Ceiling fan not working'"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <textarea
            required
            minLength={20}
            rows={5}
            placeholder="Describe the problem — what's wrong, since when, and anything the warden should know. (min 20 characters)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </Card>

        <Card>
          <label className="text-sm font-medium text-slate-700">How urgent is it?</label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.value}
                onClick={() => setForm({ ...form, priority: p.value })}
                className={`rounded-xl border p-2.5 text-center transition ${
                  form.priority === p.value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className={`block text-xs font-bold ${p.value === 'URGENT' && form.priority === p.value ? 'text-red-600' : 'text-slate-700'}`}>{p.value}</span>
                <span className="block text-[11px] text-slate-400">{p.hint}</span>
              </button>
            ))}
          </div>
        </Card>

        <ErrorNote error={error} />
        <button disabled={create.isPending} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {create.isPending ? 'Submitting…' : 'Submit complaint'}
        </button>
      </form>
    </div>
  );
}
