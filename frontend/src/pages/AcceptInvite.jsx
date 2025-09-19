import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { Card, ErrorNote, Spinner } from '../components/ui';

export default function AcceptInvite() {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api(`/api/invites/${token}`),
  });

  const accept = useMutation({
    mutationFn: () => api(`/api/invites/${token}/accept`, { method: 'POST', body: { password } }),
    onSuccess: () => setDone(true),
  });

  if (invite.isLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner className="h-8 w-8" /></div>;
  if (invite.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-sm p-6 text-center">
          <p className="text-sm text-rose-600">{invite.error.message}</p>
          <Link to="/login" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">Go to sign in</Link>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="max-w-sm p-6 text-center">
          <h1 className="text-lg font-semibold">You're all set! ✅</h1>
          <p className="mt-2 text-sm text-slate-500">Your account is active. Sign in with the password you just set.</p>
          <Link to="/login" className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Set your password</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          Invite for <span className="font-medium text-slate-700">{invite.data.email}</span> ({invite.data.role.toLowerCase()})
        </p>
        <form onSubmit={(e) => { e.preventDefault(); accept.mutate(); }} className="space-y-4">
          <input
            required
            type="password"
            placeholder="New password (8+ chars, letter & number)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <ErrorNote error={accept.error} />
          <button disabled={accept.isPending} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {accept.isPending ? 'Saving…' : 'Save & activate'}
          </button>
        </form>
      </Card>
    </div>
  );
}
