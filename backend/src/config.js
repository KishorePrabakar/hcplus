require('dotenv').config();

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const isProd = process.env.NODE_ENV === 'production';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

if (isProd && (!jwtAccessSecret || !jwtRefreshSecret || jwtAccessSecret.length < 32 || jwtRefreshSecret.length < 32)) {
  throw new Error('JWT secrets must be set to at least 32 chars in production');
}

module.exports = {
  isProd,
  port: Number(process.env.PORT || 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtAccessSecret,
  jwtRefreshSecret,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
};
