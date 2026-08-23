import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { TEST_DATABASE_URL, TEST_SCHEMA } from './env.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default async function globalSetup() {
  // Ensure the test schema exists (avoids needing CREATEDB privileges).
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  await client.end();

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
