import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TEST_SCHEMA = process.env.TEST_DB_SCHEMA || 'hcplus_test';

export function readEnvVar(name) {
  const envPath = path.join(backendRoot, '.env');
  if (!fs.existsSync(envPath)) return undefined;
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  if (!line) return undefined;
  return line.slice(name.length + 1).trim().replace(/^"(.*)"$/, '$1');
}

export function computeTestDatabaseUrl() {
  const url = readEnvVar('DATABASE_URL') || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing from backend/.env');
  return url.includes('schema=')
    ? url.replace(/schema=[^&]+/, `schema=${TEST_SCHEMA}`)
    : `${url}${url.includes('?') ? '&' : '?'}schema=${TEST_SCHEMA}`;
}

export const TEST_DATABASE_URL = computeTestDatabaseUrl();
