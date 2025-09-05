const express = require('express');
const db = require('../../db');
const config = require('../../config');
const validate = require('../../middlewares/validate');
const { requireAuth } = require('../../middlewares/auth');
const { ApiError } = require('../../middlewares/error');
const { publicUser } = require('../../utils/user');
const { registerSchema, loginSchema } = require('../../validators/auth.schema');
const {
  bcrypt,
  signAccessToken,
  createRefreshToken,
  sha256,
  refreshCookieOptions,
  REFRESH_COOKIE,
} = require('../../utils/tokens');

const router = express.Router();

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, hostel, roomNumber } = req.body;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        hostel,
        roomNumber,
        role: 'STUDENT',
        status: 'PENDING',
      },
    });

    res.status(201).json({
      user: publicUser(user),
      message: 'Account created. A warden or admin will approve it shortly.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({ where: { email } });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new ApiError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
    if (user.status === 'SUSPENDED') {
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Contact admin.');
    }

    const { token: refresh } = await createRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOptions());
    res.json({ accessToken: signAccessToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new ApiError(401, 'NO_SESSION', 'No refresh session');

    const row = await db.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { user: true },
    });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw new ApiError(401, 'SESSION_INVALID', 'Session expired, sign in again');
    }

    await db.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    if (row.user.status === 'SUSPENDED') {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
      throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended');
    }

    const { token: refresh } = await createRefreshToken(row.user.id);
    res.cookie(REFRESH_COOKIE, refresh, refreshCookieOptions());
    res.json({ accessToken: signAccessToken(row.user), user: publicUser(row.user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (raw) {
      await db.refreshToken.updateMany({
        where: { tokenHash: sha256(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
