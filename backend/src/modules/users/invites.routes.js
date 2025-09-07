const express = require('express');
const db = require('../../db');
const validate = require('../../middlewares/validate');
const { ApiError } = require('../../middlewares/error');
const { publicUser } = require('../../utils/user');
const { bcrypt, sha256 } = require('../../utils/tokens');
const { inviteAcceptSchema } = require('../../validators/auth.schema');

const router = express.Router();

router.get('/invites/:token', async (req, res, next) => {
  try {
    const invite = await db.invite.findUnique({ where: { tokenHash: sha256(req.params.token) } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new ApiError(410, 'INVITE_INVALID', 'This invite link is invalid or has expired');
    }
    const existing = await db.user.findUnique({ where: { email: invite.email } });
    res.json({
      email: invite.email,
      role: invite.role,
      hostel: invite.hostel,
      roomNumber: invite.roomNumber,
      name: existing ? undefined : invite.name,
      alreadyPending: Boolean(existing && existing.status === 'PENDING'),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/invites/:token/accept', validate(inviteAcceptSchema), async (req, res, next) => {
  try {
    const invite = await db.invite.findUnique({ where: { tokenHash: sha256(req.params.token) } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new ApiError(410, 'INVITE_INVALID', 'This invite link is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const existing = await db.user.findUnique({ where: { email: invite.email } });

    let user;
    if (existing) {
      user = await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: existing.status === 'PENDING' ? 'ACTIVE' : existing.status,
          hostel: invite.hostel ?? existing.hostel,
          roomNumber: invite.roomNumber ?? existing.roomNumber,
        },
      });
    } else {
      user = await db.user.create({
        data: {
          name: invite.name,
          email: invite.email,
          passwordHash,
          role: invite.role,
          status: 'ACTIVE',
          hostel: invite.hostel,
          roomNumber: invite.roomNumber,
        },
      });
    }

    await db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    res.json({ user: publicUser(user), message: 'Account ready. You can sign in now.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
