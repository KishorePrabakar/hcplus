const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, status: user.status },
    config.jwtAccessSecret,
    { expiresIn: config.accessTokenTtl }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtAccessSecret);
}

function generateOpaqueToken() {
  return crypto.randomBytes(48).toString('hex');
}

async function createRefreshToken(userId) {
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  await db.refreshToken.create({
    data: { tokenHash: sha256(token), userId, expiresAt },
  });
  return { token, expiresAt };
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/api/auth',
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  };
}

const REFRESH_COOKIE = 'hc_refresh';

module.exports = {
  sha256,
  bcrypt,
  signAccessToken,
  verifyAccessToken,
  createRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE,
};
