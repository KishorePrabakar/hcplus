const express = require('express');
const crypto = require('crypto');
const db = require('../../db');
const config = require('../../config');
const validate = require('../../middlewares/validate');
const { requireAuth, requireActiveStaff, requireAdmin } = require('../../middlewares/auth');
const { ApiError } = require('../../middlewares/error');
const { publicUser } = require('../../utils/user');
const { bcrypt, sha256 } = require('../../utils/tokens');
const {
  statusActionSchema,
  staffCreateSchema,
  roleChangeSchema,
  bulkInviteSchema,
  inviteCreateSchema,
} = require('../../validators/user.schema');

const router = express.Router();
router.use(requireAuth);

function inviteUrl(token) {
  return `${config.corsOrigin[0]}/accept-invite/${token}`;
}

router.get('/users', ...requireActiveStaff, async (req, res, next) => {
  try {
    const { role, status, q } = req.query;
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (q) where.OR = [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }];
    if (req.user.role === 'WARDEN') where.role = 'STUDENT';

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ users: users.map(publicUser) });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/users/:id/status',
  ...requireActiveStaff,
  validate(statusActionSchema),
  async (req, res, next) => {
    try {
      const target = await db.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
      if (target.id === req.user.id) throw new ApiError(400, 'SELF_ACTION', 'You cannot change your own status');

      const { action } = req.body;
      const map = { APPROVE: 'ACTIVE', REACTIVATE: 'ACTIVE', SUSPEND: 'SUSPENDED', REJECT: 'PENDING' };

      if (action === 'REJECT') {
        await db.refreshToken.updateMany({ where: { userId: target.id }, data: { revokedAt: new Date() } });
        await db.user.delete({ where: { id: target.id } });
        return res.json({ deleted: true });
      }

      if (req.user.role === 'WARDEN' && (target.role !== 'STUDENT' || action !== 'APPROVE')) {
        throw new ApiError(403, 'FORBIDDEN', 'Wardens can only approve student accounts');
      }
      if (action === 'SUSPEND' && target.role === 'ADMIN') {
        throw new ApiError(403, 'FORBIDDEN', 'Admins cannot be suspended');
      }

      const user = await db.user.update({
        where: { id: target.id },
        data: { status: map[action] },
      });
      if (user.status === 'SUSPENDED') {
        await db.refreshToken.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
      }
      res.json({ user: publicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/users/staff', ...requireAdmin, validate(staffCreateSchema), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    const user = await db.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role, status: 'ACTIVE' },
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:id/role', ...requireAdmin, validate(roleChangeSchema), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id && req.body.role !== 'ADMIN') {
      throw new ApiError(400, 'SELF_DEMOTE', 'You cannot demote yourself');
    }
    const user = await db.user.update({ where: { id: req.params.id }, data: { role: req.body.role } });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/invites', ...requireAdmin, validate(inviteCreateSchema), async (req, res, next) => {
  try {
    const { name, email, hostel, roomNumber, role } = req.body;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

    const token = crypto.randomBytes(32).toString('hex');
    const invite = await db.invite.create({
      data: {
        name,
        email,
        hostel,
        roomNumber,
        role,
        tokenHash: sha256(token),
        createdById: req.user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    res.status(201).json({ invite: { id: invite.id, email, expiresAt: invite.expiresAt }, url: inviteUrl(token) });
  } catch (err) {
    next(err);
  }
});

router.post('/invites/bulk', ...requireAdmin, validate(bulkInviteSchema), async (req, res, next) => {
  try {
    const results = [];
    for (const row of req.body.rows) {
      const existing = await db.user.findUnique({ where: { email: row.email } });
      if (existing || !row.name) {
        results.push({ email: row.email, ok: false, reason: existing ? 'EMAIL_TAKEN' : 'NAME_REQUIRED' });
        continue;
      }
      const token = crypto.randomBytes(32).toString('hex');
      await db.invite.create({
        data: {
          name: row.name,
          email: row.email,
          hostel: row.hostel,
          roomNumber: row.roomNumber,
          tokenHash: sha256(token),
          createdById: req.user.id,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
      results.push({ email: row.email, ok: true, url: inviteUrl(token) });
    }
    res.status(201).json({ results });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
