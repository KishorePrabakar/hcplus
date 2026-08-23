import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, db, login, bearer, uniqueEmail, createUser, TEST_PASSWORD } from './helpers.js';
import { extractInviteToken } from './helpers.js';

describe('GET /api/users', () => {
  it('is staff-only', async () => {
    const student = await createUser({ role: 'STUDENT' });
    const { token } = await login(student.email);
    const res = await request(app).get('/api/users').set(bearer(token));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets wardens see only students', async () => {
    await createUser({ role: 'STUDENT' });
    await createUser({ role: 'WARDEN' });
    await createUser({ role: 'ADMIN' });

    const { token } = await login((await createUser({ role: 'WARDEN' })).email);
    const res = await request(app).get('/api/users').set(bearer(token));

    expect(res.status).toBe(200);
    const roles = new Set(res.body.users.map((u) => u.role));
    expect(roles.has('STUDENT')).toBe(true);
    expect(roles).toEqual(new Set(['STUDENT']));
  });

  it('lets admins filter by status', async () => {
    await createUser({ role: 'STUDENT', status: 'PENDING' });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .get('/api/users')
      .query({ status: 'PENDING' })
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThan(0);
    for (const u of res.body.users) {
      expect(u.status).toBe('PENDING');
    }
  });
});

describe('PATCH /api/users/:id/status', () => {
  it('admin approves a pending student who can then file complaints', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Approve Me',
      email: uniqueEmail('approve'),
      password: TEST_PASSWORD,
    });
    const pendingId = reg.body.user.id;
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${pendingId}/status`)
      .set(bearer(token))
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('ACTIVE');
  });

  it('wardens cannot approve non-students', async () => {
    const otherWarden = await createUser({ role: 'WARDEN', status: 'PENDING' });
    const { token } = await login((await createUser({ role: 'WARDEN' })).email);

    const res = await request(app)
      .patch(`/api/users/${otherWarden.id}/status`)
      .set(bearer(token))
      .send({ action: 'APPROVE' });

    expect(res.status).toBe(403);
  });

  it('rejecting deletes the account entirely', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Reject Me',
      email: uniqueEmail('reject'),
      password: TEST_PASSWORD,
    });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${reg.body.user.id}/status`)
      .set(bearer(token))
      .send({ action: 'REJECT' });

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(await db.user.findUnique({ where: { id: reg.body.user.id } })).toBeNull();
  });

  it('suspending revokes refresh sessions and blocks login', async () => {
    const target = await createUser({ role: 'STUDENT' });
    const { cookie } = await login(target.email);
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${target.id}/status`)
      .set(bearer(token))
      .send({ action: 'SUSPEND' });
    expect(res.status).toBe(200);

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(refreshed.status).toBe(401);

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: target.email, password: TEST_PASSWORD });
    expect(relogin.status).toBe(403);
  });

  it('admins cannot be suspended', async () => {
    const victimAdmin = await createUser({ role: 'ADMIN' });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${victimAdmin.id}/status`)
      .set(bearer(token))
      .send({ action: 'SUSPEND' });

    expect(res.status).toBe(403);
  });

  it('blocks changing your own status', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { token, user } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${user.id}/status`)
      .set(bearer(token))
      .send({ action: 'SUSPEND' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_ACTION');
  });
});

describe('POST /api/users/staff', () => {
  it('admin creates an active warden directly', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);
    const email = uniqueEmail('warden');

    const res = await request(app)
      .post('/api/users/staff')
      .set(bearer(token))
      .send({ name: 'New Warden', email, password: TEST_PASSWORD, role: 'WARDEN' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('WARDEN');
    expect(res.body.user.status).toBe('ACTIVE');

    const directLogin = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    expect(directLogin.status).toBe(200);
  });

  it('rejects duplicate emails', async () => {
    const existing = await createUser({ role: 'STUDENT' });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .post('/api/users/staff')
      .set(bearer(token))
      .send({
        name: 'Dup',
        email: existing.email,
        password: TEST_PASSWORD,
        role: 'WARDEN',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('forbids non-admins', async () => {
    const warden = await createUser({ role: 'WARDEN' });
    const { token } = await login(warden.email);

    const res = await request(app)
      .post('/api/users/staff')
      .set(bearer(token))
      .send({
        name: 'Nope',
        email: uniqueEmail('nope'),
        password: TEST_PASSWORD,
        role: 'ADMIN',
      });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/users/:id/role', () => {
  it('admin promotes a student to warden', async () => {
    const student = await createUser({ role: 'STUDENT' });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${student.id}/role`)
      .set(bearer(token))
      .send({ role: 'WARDEN' });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('WARDEN');
  });

  it('blocks self-demotion from admin', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { token, user } = await login(admin.email);

    const res = await request(app)
      .patch(`/api/users/${user.id}/role`)
      .set(bearer(token))
      .send({ role: 'WARDEN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('SELF_DEMOTE');
  });
});

describe('invite flow', () => {
  const inviteBody = (overrides = {}) => ({
    name: overrides.name ?? 'Invited Student',
    email: overrides.email ?? uniqueEmail('invited'),
    hostel: overrides.hostel ?? 'Shivalik',
    roomNumber: overrides.roomNumber ?? 'C-12',
    role: overrides.role ?? 'STUDENT',
  });

  it('admin creates an invite; the link reveals info then activates the account', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const created = await request(app)
      .post('/api/invites')
      .set(bearer(token))
      .send(inviteBody());

    expect(created.status).toBe(201);
    expect(created.body.url).toMatch(/\/accept-invite\//);

    const inviteToken = extractInviteToken(created.body.url);
    const peek = await request(app).get(`/api/invites/${inviteToken}`);
    expect(peek.status).toBe(200);
    expect(peek.body.name).toBe('Invited Student');

    const accept = await request(app)
      .post(`/api/invites/${inviteToken}/accept`)
      .send({ password: TEST_PASSWORD });
    expect(accept.status).toBe(200);
    expect(accept.body.user.status).toBe('ACTIVE');
    expect(accept.body.user.hostel).toBe('Shivalik');

    const signIn = await request(app)
      .post('/api/auth/login')
      .send({ email: accept.body.user.email, password: TEST_PASSWORD });
    expect(signIn.status).toBe(200);
  });

  it('an accepted invite link cannot be reused', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);
    const created = await request(app)
      .post('/api/invites')
      .set(bearer(token))
      .send(inviteBody());
    const inviteToken = extractInviteToken(created.body.url);

    await request(app)
      .post(`/api/invites/${inviteToken}/accept`)
      .send({ password: TEST_PASSWORD });

    const replay = await request(app).get(`/api/invites/${inviteToken}`);
    expect(replay.status).toBe(410);
    expect(replay.body.error.code).toBe('INVITE_INVALID');
  });

  it('accepting an invite upgrades an existing PENDING registration to ACTIVE', async () => {
    const email = uniqueEmail('upgrade');
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    // invite exists before the student self-registers
    const created = await request(app)
      .post('/api/invites')
      .set(bearer(token))
      .send(inviteBody({ email }));
    expect(created.status).toBe(201);
    const inviteToken = extractInviteToken(created.body.url);

    const reg = await request(app).post('/api/auth/register').send({
      name: 'Pending Person',
      email,
      password: TEST_PASSWORD,
    });
    expect(reg.body.user.status).toBe('PENDING');

    const accept = await request(app)
      .post(`/api/invites/${inviteToken}/accept`)
      .send({ password: TEST_PASSWORD });

    expect(accept.status).toBe(200);
    expect(accept.body.user.id).toBe(reg.body.user.id);
    expect(accept.body.user.status).toBe('ACTIVE');

    const signIn = await request(app)
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD });
    expect(signIn.status).toBe(200);
  });

  it('bulk invites report per-row success and duplicate failures', async () => {
    const existing = await createUser({ role: 'STUDENT' });
    const admin = await createUser({ role: 'ADMIN' });
    const { token } = await login(admin.email);

    const res = await request(app)
      .post('/api/invites/bulk')
      .set(bearer(token))
      .send({
        rows: [
          { name: 'Bulk One', email: uniqueEmail('bulk1') },
          { name: 'Bulk Dup', email: existing.email },
          { email: uniqueEmail('noname') },
        ],
      });

    expect(res.status).toBe(201);
    const byEmail = Object.fromEntries(res.body.results.map((r) => [r.email, r]));
    expect(Object.values(byEmail).filter((r) => r.ok)).toHaveLength(1);
    expect(byEmail[existing.email]).toMatchObject({ ok: false, reason: 'EMAIL_TAKEN' });
    expect(Object.values(byEmail).find((r) => r.reason === 'NAME_REQUIRED')).toBeTruthy();
  });

  it('students cannot create invites', async () => {
    const student = await createUser({ role: 'STUDENT' });
    const { token } = await login(student.email);

    const res = await request(app)
      .post('/api/invites')
      .set(bearer(token))
      .send(inviteBody());

    expect(res.status).toBe(403);
  });
});
