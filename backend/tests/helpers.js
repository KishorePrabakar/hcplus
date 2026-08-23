import request from 'supertest';
import app from '../src/app.js';
import db from '../src/db.js';

export { app, db };

export const TEST_PASSWORD = 'Passw0rd!123';

let counter = 0;
export function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}@test.dev`;
}

export async function createUser(overrides = {}) {
  const password = overrides.password ?? TEST_PASSWORD;
  const user = await db.user.create({
    data: {
      name: overrides.name ?? `Test ${overrides.role ?? 'STUDENT'}`,
      email: overrides.email ?? uniqueEmail(overrides.role?.toLowerCase() ?? 'student'),
      passwordHash: await bcryptHash(password),
      role: overrides.role ?? 'STUDENT',
      status: overrides.status ?? 'ACTIVE',
      hostel: overrides.hostel ?? 'Aravali',
      roomNumber: overrides.roomNumber ?? 'B-204',
    },
  });
  return { ...user, password };
}

async function bcryptHash(password) {
  const mod = await import('bcryptjs');
  const bcrypt = mod.default;
  return bcrypt.hash(password, 4);
}

export async function login(email, password = TEST_PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email} (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    token: res.body.accessToken,
    cookie: res.headers['set-cookie'],
    user: res.body.user,
    raw: res,
  };
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });

export async function createComplaint(token, overrides = {}) {
  const res = await request(app)
    .post('/api/complaints')
    .set(bearer(token))
    .send({
      title: overrides.title ?? 'Fan not working in room',
      description:
        overrides.description ??
        'The ceiling fan stopped working two days ago and the room gets very hot at night.',
      category: overrides.category ?? 'ELECTRICAL',
      priority: overrides.priority,
    });
  if (res.status !== 201) {
    throw new Error(`createComplaint failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.complaint;
}

export function extractInviteToken(url) {
  const match = url.match(/\/accept-invite\/([0-9a-f]+)/);
  if (!match) throw new Error(`no invite token in url: ${url}`);
  return match[1];
}
