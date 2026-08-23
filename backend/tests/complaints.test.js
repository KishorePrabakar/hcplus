import { describe, it, expect } from 'vitest';
import request from 'supertest';
import {
  app,
  db,
  login,
  bearer,
  createUser,
  createComplaint,
} from './helpers.js';

const seedUsers = async () => ({
  student1: await createUser({ role: 'STUDENT', name: 'Owner One' }),
  student2: await createUser({ role: 'STUDENT', name: 'Other Student' }),
  warden: await createUser({ role: 'WARDEN', name: 'Warden W' }),
  admin: await createUser({ role: 'ADMIN', name: 'Admin A' }),
});

describe('POST /api/complaints', () => {
  it('creates a complaint with a sequential code and OPEN status', async () => {
    const { student1 } = await seedUsers();
    const { token } = await login(student1.email);
    const res = await request(app)
      .post('/api/complaints')
      .set(bearer(token))
      .send({
        title: 'Water leak in corridor',
        description:
          'There is a steady water leak near room B12 that has been flooding the corridor since last night.',
        category: 'PLUMBING',
        priority: 'HIGH',
      });

    expect(res.status).toBe(201);
    expect(res.body.complaint.code).toMatch(/^HC-\d{4}$/);
    expect(res.body.complaint.status).toBe('OPEN');
    expect(res.body.complaint.priority).toBe('HIGH');
    expect(res.body.complaint.createdById).toBe(student1.id);
  });

  it('defaults priority to MEDIUM', async () => {
    const { student1 } = await seedUsers();
    const { token } = await login(student1.email);
    const complaint = await createComplaint(token);
    expect(complaint.priority).toBe('MEDIUM');
  });

  it('rejects invalid payloads with VALIDATION_ERROR', async () => {
    const { student1 } = await seedUsers();
    const { token } = await login(student1.email);
    const res = await request(app)
      .post('/api/complaints')
      .set(bearer(token))
      .send({ title: 'hi', description: 'too short', category: 'NOPE' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('blocks PENDING users with ACCOUNT_PENDING', async () => {
    const pending = await createUser({ role: 'STUDENT', status: 'PENDING' });
    const { token } = await login(pending.email);

    const res = await request(app).post('/api/complaints').set(bearer(token)).send({
      title: 'Should not be allowed',
      description: 'This description is long enough to pass validation checks.',
      category: 'OTHER',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });
});

describe('GET /api/complaints scoping and filters', () => {
  const seedComplaints = async () => {
    const { student1, student2 } = await seedUsers();
    const s1 = await login(student1.email);
    const s2 = await login(student2.email);
    const mine = await createComplaint(s1.token, {
      title: 'Zebra lights flicker',
      category: 'ELECTRICAL',
    });
    const theirs = await createComplaint(s2.token, {
      title: 'Mess food quality dropped',
      category: 'MESS',
      priority: 'LOW',
    });
    return { mine, theirs };
  };

  it('students only see their own complaints', async () => {
    const { theirs } = await seedComplaints();
    const viewer = await db.user.findFirst({ where: { name: 'Other Student' } });
    const { token } = await login(viewer.email);

    const res = await request(app).get('/api/complaints').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.complaints.map((c) => c.id)).toEqual([theirs.id]);
    expect(res.body.meta.total).toBe(1);
  });

  it('staff see all complaints', async () => {
    await seedComplaints();
    const staff = await db.user.findFirst({ where: { name: 'Warden W' } });
    const { token } = await login(staff.email);

    const res = await request(app).get('/api/complaints').set(bearer(token));

    expect(res.body.meta.total).toBe(2);
  });

  it('filters by status and searches titles/codes', async () => {
    const { mine } = await seedComplaints();
    const chief = await db.user.findFirst({ where: { name: 'Admin A' } });
    const { token } = await login(chief.email);

    const byStatus = await request(app)
      .get('/api/complaints')
      .query({ status: 'OPEN' })
      .set(bearer(token));
    expect(byStatus.body.meta.total).toBe(2);

    const byQ = await request(app)
      .get('/api/complaints')
      .query({ q: 'zebra' })
      .set(bearer(token));
    expect(byQ.body.complaints.map((c) => c.title)).toContain('Zebra lights flicker');

    const byCode = await request(app)
      .get('/api/complaints')
      .query({ q: mine.code })
      .set(bearer(token));
    expect(byCode.body.complaints.map((c) => c.id)).toEqual([mine.id]);

    const none = await request(app)
      .get('/api/complaints')
      .query({ status: 'CLOSED' })
      .set(bearer(token));
    expect(none.body.complaints).toHaveLength(0);
  });

  it('paginates with meta information', async () => {
    await seedComplaints();
    const chief = await db.user.findFirst({ where: { name: 'Admin A' } });
    const { token } = await login(chief.email);

    const res = await request(app)
      .get('/api/complaints')
      .query({ page: 2, pageSize: 1 })
      .set(bearer(token));

    expect(res.body.complaints).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
  });
});

describe('GET /api/complaints/:id access control', () => {
  it("hides other students' complaints behind a 404", async () => {
    const { student1, student2, warden, admin } = await seedUsers();
    const owner = await login(student1.email);
    const outsider = await login(student2.email);
    const complaint = await createComplaint(owner.token);

    const ok = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set(bearer(owner.token));
    expect(ok.status).toBe(200);

    const hidden = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set(bearer(outsider.token));
    expect(hidden.status).toBe(404);
    expect(hidden.body.error.code).toBe('NOT_FOUND');

    const staffView = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set(bearer((await login(warden.email)).token));
    expect(staffView.status).toBe(200);

    const missing = await request(app)
      .get('/api/complaints/doesnotexist123')
      .set(bearer((await login(admin.email)).token));
    expect(missing.status).toBe(404);
  });
});

describe('comments', () => {
  it('participants can comment; strangers cannot', async () => {
    const { student1, student2, warden } = await seedUsers();
    const owner = await login(student1.email);
    const stranger = await login(student2.email);
    const staff = await login(warden.email);
    const complaint = await createComplaint(owner.token);

    const posted = await request(app)
      .post(`/api/complaints/${complaint.id}/comments`)
      .set(bearer(owner.token))
      .send({ body: 'Any update on this?' });
    expect(posted.status).toBe(201);
    expect(posted.body.comment.author.id).toBe(student1.id);

    const staffComment = await request(app)
      .post(`/api/complaints/${complaint.id}/comments`)
      .set(bearer(staff.token))
      .send({ body: 'Technician scheduled for tomorrow.' });
    expect(staffComment.status).toBe(201);

    const denied = await request(app)
      .post(`/api/complaints/${complaint.id}/comments`)
      .set(bearer(stranger.token))
      .send({ body: 'Me too!!' });
    expect(denied.status).toBe(404);

    const detail = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set(bearer(staff.token));
    expect(detail.body.comments).toHaveLength(2);
    expect(detail.body.timeline[0].toStatus).toBe('OPEN');
  });

  it('rejects empty comments with 422', async () => {
    const { student1 } = await seedUsers();
    const owner = await login(student1.email);
    const complaint = await createComplaint(owner.token);
    const res = await request(app)
      .post(`/api/complaints/${complaint.id}/comments`)
      .set(bearer(owner.token))
      .send({ body: '   ' });

    expect(res.status).toBe(422);
  });
});

describe('lifecycle transitions', () => {
  const fresh = async () => {
    const { student1 } = await seedUsers();
    const owner = await login(student1.email);
    return { owner, complaint: await createComplaint(owner.token) };
  };
  const wardenLogin = async () => {
    const w = await createUser({ role: 'WARDEN', name: 'Fresh Warden' });
    return login(w.email);
  };

  it('rejects unknown actions at validation', async () => {
    const { owner, complaint } = await fresh();
    const res = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'EXPLODE' });

    expect(res.status).toBe(422);
  });

  it('students cannot claim', async () => {
    const { owner, complaint } = await fresh();
    const res = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'CLAIM' });

    expect(res.status).toBe(403);
  });

  it('claim → in_progress with assignment, then double-claim fails', async () => {
    const warden = await createUser({ role: 'WARDEN', name: 'Claimer' });
    const staff = await login(warden.email);
    const { complaint } = await fresh();

    const claimed = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'CLAIM' });

    expect(claimed.status).toBe(200);
    expect(claimed.body.complaint.status).toBe('IN_PROGRESS');
    expect(claimed.body.complaint.assignedToId).toBe(warden.id);

    const again = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'CLAIM' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('resolve requires a note, then records resolution metadata', async () => {
    const staff = await wardenLogin();
    const { complaint } = await fresh();

    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'CLAIM' });

    const noNote = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'RESOLVE' });
    expect(noNote.status).toBe(422);
    expect(noNote.body.error.code).toBe('NOTE_REQUIRED');

    const resolved = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'RESOLVE', note: 'Replaced the fan capacitor.' });

    expect(resolved.status).toBe(200);
    expect(resolved.body.complaint.status).toBe('RESOLVED');
    expect(resolved.body.complaint.resolutionNote).toBe('Replaced the fan capacitor.');
    expect(resolved.body.complaint.resolvedAt).toBeTruthy();
  });

  it('owner closes a resolved complaint; timeline records every hop', async () => {
    const staff = await wardenLogin();
    const strangerUser = await createUser({ role: 'STUDENT', name: 'Stranger S' });
    const stranger = await login(strangerUser.email);
    const { owner, complaint } = await fresh();

    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'CLAIM' });
    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'RESOLVE', note: 'Fixed.' });

    const closedByStranger = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(stranger.token))
      .send({ action: 'CLOSE' });
    expect(closedByStranger.status).toBe(404);

    const closed = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'CLOSE' });
    expect(closed.status).toBe(200);
    expect(closed.body.complaint.status).toBe('CLOSED');
    expect(closed.body.complaint.closedAt).toBeTruthy();

    const reclose = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'CLOSE' });
    expect(reclose.status).toBe(409);

    const detail = await request(app)
      .get(`/api/complaints/${complaint.id}`)
      .set(bearer(staff.token));
    const hops = detail.body.timeline.map((e) => `${e.fromStatus ?? ''}>${e.toStatus}`);
    expect(hops).toEqual(['>OPEN', 'OPEN>IN_PROGRESS', 'IN_PROGRESS>RESOLVED', 'RESOLVED>CLOSED']);
  });

  it('owner reopens within the window; limits and windows are enforced', async () => {
    const staff = await wardenLogin();
    const { owner, complaint } = await fresh();

    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'CLAIM' });
    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'RESOLVE', note: 'First fix attempt.' });

    const reopened = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'REOPEN', note: 'Still not fixed.' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.complaint.status).toBe('IN_PROGRESS');
    expect(reopened.body.complaint.reopenedCount).toBe(1);

    // exhaust the reopen budget directly to test the cap
    await db.complaint.update({
      where: { id: complaint.id },
      data: { reopenedCount: 3 },
    });
    // resolve again so REOPEN is legal
    await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'RESOLVE', note: 'Second fix attempt.' });

    const capped = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'REOPEN' });
    expect(capped.status).toBe(409);
    expect(capped.body.error.code).toBe('TOO_MANY_REOPENS');

    // window expiry
    await db.complaint.update({
      where: { id: complaint.id },
      data: { resolvedAt: new Date(Date.now() - 73 * 3600 * 1000) },
    });
    const expired = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(owner.token))
      .send({ action: 'REOPEN' });
    expect(expired.status).toBe(409);
    expect(expired.body.error.code).toBe('REOPEN_WINDOW_PASSED');
  });

  it('reject moves straight to terminal with a required reason', async () => {
    const chiefUser = await createUser({ role: 'ADMIN', name: 'Chief Admin' });
    const staff = await login(chiefUser.email);
    const { complaint } = await fresh();

    const noNote = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'REJECT' });
    expect(noNote.status).toBe(422);

    const rejected = await request(app)
      .patch(`/api/complaints/${complaint.id}/transition`)
      .set(bearer(staff.token))
      .send({ action: 'REJECT', note: 'Duplicate of an existing ticket.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.complaint.status).toBe('REJECTED');
    expect(rejected.body.complaint.closedAt).toBeTruthy();
  });
});

describe('priority and assignment (staff-only)', () => {
  it('updates priority', async () => {
    const { student1, warden } = await seedUsers();
    const owner = await login(student1.email);
    const staff = await login(warden.email);
    const complaint = await createComplaint(owner.token);

    const denied = await request(app)
      .patch(`/api/complaints/${complaint.id}/priority`)
      .set(bearer(owner.token))
      .send({ priority: 'URGENT' });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .patch(`/api/complaints/${complaint.id}/priority`)
      .set(bearer(staff.token))
      .send({ priority: 'URGENT' });
    expect(ok.status).toBe(200);
    expect(ok.body.complaint.priority).toBe('URGENT');
  });

  it('assigns and clears wardens, validating the assignee role', async () => {
    const { student1, admin } = await seedUsers();
    const owner = await login(student1.email);
    const chief = await login(admin.email);
    const colleagueWarden = await createUser({ role: 'WARDEN', name: 'Colleague W' });
    const plainStudent = await createUser({ role: 'STUDENT', name: 'Plain P' });
    const complaint = await createComplaint(owner.token);

    const denied = await request(app)
      .patch(`/api/complaints/${complaint.id}/assign`)
      .set(bearer(owner.token))
      .send({ assignedToId: colleagueWarden.id });
    expect(denied.status).toBe(403);

    const assigned = await request(app)
      .patch(`/api/complaints/${complaint.id}/assign`)
      .set(bearer(chief.token))
      .send({ assignedToId: colleagueWarden.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.complaint.assignedToId).toBe(colleagueWarden.id);

    const badAssignee = await request(app)
      .patch(`/api/complaints/${complaint.id}/assign`)
      .set(bearer(chief.token))
      .send({ assignedToId: plainStudent.id });
    expect(badAssignee.status).toBe(422);
    expect(badAssignee.body.error.code).toBe('INVALID_ASSIGNEE');

    const cleared = await request(app)
      .patch(`/api/complaints/${complaint.id}/assign`)
      .set(bearer(chief.token))
      .send({ assignedToId: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.complaint.assignedToId).toBeNull();
  });
});
