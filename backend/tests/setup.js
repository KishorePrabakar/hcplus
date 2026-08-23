import { beforeEach } from 'vitest';
import { TEST_DATABASE_URL } from './env.mjs';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || TEST_DATABASE_URL;
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

const { default: db } = await import('../src/db.js');

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE "User", "RefreshToken", "Complaint", "Invite", "Comment", "StatusEvent" CASCADE'
  );
});
