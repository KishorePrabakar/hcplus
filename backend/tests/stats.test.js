import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, login, bearer, createUser, createComplaint } from './helpers.js';

async function seedWorld() {
  const student1 = await createUser({ role: 'STUDENT', name: 'Stat S1' });
  const student2 = await createUser({ role: 'STUDENT', name: 'Stat S2' });
  const warden1 = await createUser({ role: 'WARDEN', name: 'Stat W1' });
  const warden2 = await createUser({ role: 'WARDEN', name: 'Stat W2' });
  const admin = await createUser({ role: 'ADMIN', name: 'Stat A' });

  const s1 = await login(student1.email);
  const s2 = await login(student2.email);

  const urgent = await createComplaint(s1.token, {
    title: 'Urgent electrical short circuit',
    category: 'ELECTRICAL',
    priority: 'URGENT',
  });
  const resolvedOne = await createComplaint(s1.token, {
    title: 'Broken study table drawer',
    category: 'FURNITURE',
    priority: 'LOW',
  });
  const mess = await createComplaint(s2.token, {
    title: 'Mess running out of drinking water',
    category: 'MESS',
    priority: 'HIGH',
  });

  const staff = await login(warden1.email);
  await request(app)
    .patch(`/api/complaints/${resolvedOne.id}/transition`)
    .set(bearer(staff.token))
    .send({ action: 'CLAIM' });
  const done = await request(app)
    .patch(`/api/complaints/${resolvedOne.id}/transition`)
    .set(bearer(staff.token))
    .send({ action: 'RESOLVE', note: 'Replaced the drawer.' });
  if (done.status !== 200) throw new Error(`resolve failed: ${JSON.stringify(done.body)}`);

  return { student1, warden1, warden2, admin, urgent, mess };
}

describe('GET /api/stats/dashboard', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/stats/dashboard');
    expect(res.status).toBe(401);
  });

  it('scopes student stats to their own complaints', async () => {
    const { student1, urgent } = await seedWorld();
    const me = await login(student1.email);

    const res = await request(app).get('/api/stats/dashboard').set(bearer(me.token));

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('STUDENT');
    expect(res.body.byStatus).toEqual({ OPEN: 1, RESOLVED: 1 });
    expect(res.body.activeByPriority).toEqual({ URGENT: 1 });
    expect(res.body.recent.map((c) => c.id)).toContain(urgent.id);
    expect(res.body.byCategory).toBeUndefined();
    expect(res.body.pendingApprovals).toBeUndefined();
  });

  it('gives staff campus-wide counts including approvals and workload', async () => {
    const { warden1, warden2, admin, urgent } = await seedWorld();
    await createUser({ role: 'STUDENT', status: 'PENDING', name: 'Waiting One' });
    await createUser({ role: 'STUDENT', status: 'PENDING', name: 'Waiting Two' });

    const chief = await login(admin.email);
    const assigned = await request(app)
      .patch(`/api/complaints/${urgent.id}/assign`)
      .set(bearer(chief.token))
      .send({ assignedToId: warden2.id });
    expect(assigned.status).toBe(200);

    const w2StatsBeforeClaim = await request(app)
      .get('/api/stats/dashboard')
      .set(bearer((await login(warden2.email)).token));
    expect(w2StatsBeforeClaim.body.assignedToMe).toBe(0);

    const w2 = await login(warden2.email);
    await request(app)
      .patch(`/api/complaints/${urgent.id}/transition`)
      .set(bearer(w2.token))
      .send({ action: 'CLAIM' });

    const w2Stats = await request(app)
      .get('/api/stats/dashboard')
      .set(bearer(w2.token));
    expect(w2Stats.body.assignedToMe).toBe(1);

    const res = await request(app)
      .get('/api/stats/dashboard')
      .set(bearer((await login(warden1.email)).token));

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('WARDEN');
    expect(res.body.byStatus).toEqual({ OPEN: 1, IN_PROGRESS: 1, RESOLVED: 1 });
    expect(res.body.byCategory).toEqual({ ELECTRICAL: 1, MESS: 1 });
    expect(res.body.urgentOpen).toBe(1);
    expect(res.body.pendingApprovals).toBe(2);
    expect(res.body.recent).toBeUndefined();
    expect(res.body.assignedToMe).toBe(0);
  });
});
