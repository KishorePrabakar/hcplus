import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, db, login, bearer, uniqueEmail, createUser, TEST_PASSWORD } from './helpers.js';

const registerBody = (overrides = {}) => ({
  name: overrides.name ?? 'New Student',
  email: overrides.email ?? uniqueEmail('register'),
  password: overrides.password ?? TEST_PASSWORD,
  hostel: overrides.hostel ?? 'Nilgiri',
  roomNumber: overrides.roomNumber ?? 'A-101',
});

describe('POST /api/auth/register', () => {
  it('creates a PENDING student account', async () => {
    const body = registerBody();
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(body.email);
    expect(res.body.user.role).toBe('STUDENT');
    expect(res.body.user.status).toBe('PENDING');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.message).toMatch(/approve/i);
  });

  it('rejects duplicate emails with 409', async () => {
    const body = registerBody();
    await request(app).post('/api/auth/register').send(body);
    const res = await request(app).post('/api/auth/register').send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects weak passwords with 422 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(registerBody({ password: 'short' }));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  it('returns an access token and sets the refresh cookie', async () => {
    const created = await createUser({ role: 'STUDENT' });
    const res = await request(app).post('/api/auth/login').send({
      email: created.email,
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.id).toBe(created.id);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toContain('hc_refresh=');
    expect(cookie).toContain('HttpOnly');
  });

  it('allows PENDING users to authenticate', async () => {
    const created = await createUser({ status: 'PENDING' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: created.email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('PENDING');
  });

  it('rejects wrong passwords with 401 BAD_CREDENTIALS', async () => {
    const created = await createUser();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: created.email, password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('BAD_CREDENTIALS');
  });

  it('rejects suspended users with 403 ACCOUNT_SUSPENDED', async () => {
    const created = await createUser({ status: 'SUSPENDED' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: created.email, password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user without secrets', async () => {
    const { token, user } = await login((await createUser()).email);
    const res = await request(app).get('/api/auth/me').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('requires a bearer token', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('refresh token rotation', () => {
  it('issues a fresh session and invalidates the old refresh token', async () => {
    const { cookie } = await login((await createUser()).email);

    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();

    // replay of the rotated-away token must fail
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('SESSION_INVALID');
  });

  it('rejects refresh without a cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_SESSION');
  });

  it('blocks refresh for suspended users and clears the cookie', async () => {
    const created = await createUser();
    const { cookie } = await login(created.email);
    await db.user.update({ where: { id: created.id }, data: { status: 'SUSPENDED' } });

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.headers['set-cookie'][0]).toContain('hc_refresh=;');
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session so refresh stops working', async () => {
    const { cookie } = await login((await createUser()).email);

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);

    const after = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});
