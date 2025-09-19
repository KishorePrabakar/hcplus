import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Card, ErrorNote } from '../components/ui';

const HOSTELS = ['Block A', 'Block B', 'Block C', "Girls' Hostel", 'PG / Other'];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', hostel: '', roomNumber: '' });
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: {
          ...form,
          hostel: form.hostel || undefined,
          roomNumber: form.roomNumber || undefined,
        },
      });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm p-6 text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-2 text-lg font-semibold">Account created!</h1>
          <p className="mt-2 text-sm text-slate-500">
            A warden or admin will approve your account shortly. You can sign in once approved.
          </p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Go to sign in
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Create student account</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">Approval by a warden is required after signup.</p>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Full name" value={form.name} onChange={set('name')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={set('email')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input required type="password" placeholder="Password (8+ chars, letter & number)" value={form.password} onChange={set('password')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <select value={form.hostel} onChange={set('hostel')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">
            <option value="">Select hostel (optional)</option>
            {HOSTELS.map((h) => <option key={h}>{h}</option>)}
          </select>
          <input placeholder="Room number (optional)" value={form.roomNumber} onChange={set('roomNumber')} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <ErrorNote error={error} />
          <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
