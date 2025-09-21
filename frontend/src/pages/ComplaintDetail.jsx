import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, StatusBadge, PriorityBadge, Spinner, ErrorNote } from '../components/ui';

const fmt = (d) => new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [actionError, setActionError] = useState(null);

  const detail = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => api(`/api/complaints/${id}`),
  });

  const refresh = async () => {
    setActionError(null);
    await qc.invalidateQueries({ queryKey: ['complaint', id] });
    await qc.invalidateQueries({ queryKey: ['stats'] });
  };

  const transition = useMutation({
    mutationFn: ({ action, note }) => api(`/api/complaints/${id}/transition`, { method: 'PATCH', body: { action, note: note || undefined } }),
    onSuccess: refresh,
    onError: setActionError,
  });

  const addComment = useMutation({
    mutationFn: () => api(`/api/complaints/${id}/comments`, { method: 'POST', body: { body: comment } }),
    onSuccess: async () => {
      setComment('');
      await qc.invalidateQueries({ queryKey: ['complaint', id] });
    },
  });

  if (detail.isLoading) return <Spinner />;
  if (detail.isError) return <ErrorNote error={detail.error} />;

  const { complaint, comments, timeline } = detail.data;
  const isStaff = user.role === 'WARDEN' || user.role === 'ADMIN';
  const isOwner = complaint.createdBy.id === user.id;
  const canReopen =
    complaint.status === 'RESOLVED' &&
    (isOwner || isStaff) &&
    complaint.resolvedAt &&
    (Date.now() - new Date(complaint.resolvedAt)) / 3600000 <= 72;

  const actions = [];
  if (isStaff && complaint.status === 'OPEN') actions.push({ action: 'CLAIM', label: 'Claim & start working', style: 'bg-indigo-600' });
  if ((isStaff || isOwner) && complaint.status === 'RESOLVED') actions.push({ action: 'CLOSE', label: 'Confirm fixed — close', style: 'bg-emerald-600' });
  if (canReopen) actions.push({ action: 'REOPEN', label: 'Not fixed — reopen', style: 'bg-amber-500', needsNote: true });
  if (isStaff && ['OPEN', 'IN_PROGRESS'].includes(complaint.status)) actions.push({ action: 'RESOLVE', label: 'Mark resolved', style: 'bg-emerald-600', needsNote: true });
  if (isStaff && ['OPEN', 'IN_PROGRESS'].includes(complaint.status)) actions.push({ action: 'REJECT', label: 'Reject', style: 'bg-rose-600', needsNote: true });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to={isStaff ? '/queue' : '/'} className="text-sm text-slate-500 hover:text-indigo-600">← Back</Link>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-slate-400">{complaint.code}</span>
          <StatusBadge status={complaint.status} />
          <PriorityBadge priority={complaint.priority} />
        </div>
        <h1 className="mt-2 text-lg font-bold">{complaint.title}</h1>
        <p className="mt-1 text-xs text-slate-400">
          Filed by {isOwner ? 'you' : complaint.createdBy.name}
          {!isOwner && ` · ${complaint.createdBy.hostel || ''} ${complaint.createdBy.roomNumber || ''}`} · {fmt(complaint.createdAt)}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{complaint.description}</p>
        {complaint.resolutionNote && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <span className="font-semibold">Resolution:</span> {complaint.resolutionNote}
          </div>
        )}
      </Card>

      {actions.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-medium text-slate-700">Actions</p>
          <ActionButtons actions={actions} transition={transition} />
          <ErrorNote error={actionError} />
        </Card>
      )}

      <Card>
        <p className="mb-3 text-sm font-medium text-slate-700">Timeline</p>
        <ol className="relative space-y-3 border-l border-slate-200 pl-5">
          {[...timeline].reverse().map((ev) => (
            <li key={ev.id}>
              <span className="absolute -left-[7px] mt-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-indigo-500" />
              <p className="text-sm">
                <StatusBadge status={ev.toStatus} />
                <span className="ml-2 text-slate-600">
                  {ev.fromStatus ? `${ev.fromStatus.replace('_', ' ')} → ${ev.toStatus.replace('_', ' ')}` : 'Created'}
                </span>
              </p>
              <p className="text-xs text-slate-400">by {ev.actor.name} · {fmt(ev.createdAt)}{ev.note ? ` — ${ev.note}` : ''}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <p className="mb-3 text-sm font-medium text-slate-700">Comments ({comments.length})</p>
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className={`rounded-lg p-3 text-sm ${c.author.id === user.id ? 'bg-indigo-50' : 'bg-slate-50'}`}>
              <p className="text-xs font-semibold text-slate-600">
                {c.author.name} <span className="font-normal text-slate-400">· {c.author.role.toLowerCase()} · {fmt(c.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.body}</p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }}
          className="mt-3 flex gap-2"
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Write a comment…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button disabled={!comment.trim() || addComment.isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </form>
        <ErrorNote error={addComment.error} />
      </Card>
    </div>
  );
}

function ActionButtons({ actions, transition }) {
  const pending = transition.isPending;
  const simple = actions.filter((a) => !a.needsNote);
  const withNotes = actions.filter((a) => a.needsNote);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {simple.map((a) => (
          <button
            key={a.action}
            disabled={pending}
            onClick={() => transition.mutate({ action: a.action })}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${a.style}`}
          >
            {a.label}
          </button>
        ))}
      </div>
      {withNotes.map((a) => (
        <NoteAction key={a.action} action={a} transition={transition} pending={pending} />
      ))}
    </div>
  );
}

function NoteAction({ action, transition, pending }) {
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${action.style}`}
      >
        {action.label}
      </button>
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (required)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            disabled={!note.trim() || pending}
            onClick={() =>
              transition.mutate(
                { action: action.action, note },
                {
                  onSuccess: () => {
                    setNote('');
                    setOpen(false);
                  },
                }
              )
            }
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}
