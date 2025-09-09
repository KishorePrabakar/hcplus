const express = require('express');
const db = require('../../db');
const validate = require('../../middlewares/validate');
const { requireAuth, requireActive } = require('../../middlewares/auth');
const { ApiError } = require('../../middlewares/error');
const {
  createComplaintSchema,
  commentSchema,
  transitionSchema,
  assignSchema,
  prioritySchema,
  listQuerySchema,
} = require('../../validators/complaint.schema');

const router = express.Router();
router.use(requireAuth);

const REOPEN_WINDOW_HOURS = 72;
const MAX_REOPENS = 3;

const isStaff = (user) => user.role === 'WARDEN' || user.role === 'ADMIN';

async function loadComplaint(id) {
  const complaint = await db.complaint.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, hostel: true, roomNumber: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!complaint) throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  return complaint;
}

function assertCanView(user, complaint) {
  if (!isStaff(user) && complaint.createdById !== user.id) {
    throw new ApiError(404, 'NOT_FOUND', 'Complaint not found');
  }
}

async function nextCode(tx) {
  const count = await tx.complaint.count();
  return `HC-${String(count + 1).padStart(4, '0')}`;
}

function recordEvent(tx, complaintId, actorId, fromStatus, toStatus, note) {
  return tx.statusEvent.create({
    data: { complaintId, actorId, fromStatus, toStatus, note },
  });
}

router.post('/', requireActive, validate(createComplaintSchema), async (req, res, next) => {
  try {
    const { title, description, category, priority } = req.body;
    const complaint = await db.$transaction(async (tx) => {
      const code = await nextCode(tx);
      const created = await tx.complaint.create({
        data: { code, title, description, category, priority, createdById: req.user.id },
      });
      await recordEvent(tx, created.id, req.user.id, null, 'OPEN', 'Complaint filed');
      return created;
    });
    res.status(201).json({ complaint });
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { status, category, priority, q, page, pageSize } = req.query;
    const where = {};
    if (!isStaff(req.user)) where.createdById = req.user.id;
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (q) where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
    ];

    const [total, complaints] = await db.$transaction([
      db.complaint.count({ where }),
      db.complaint.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: { select: { name: true, hostel: true, roomNumber: true } },
          assignedTo: { select: { name: true } },
        },
      }),
    ]);

    res.json({
      complaints,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const complaint = await loadComplaint(req.params.id);
    assertCanView(req.user, complaint);
    const [comments, events] = await Promise.all([
      db.comment.findMany({
        where: { complaintId: complaint.id },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, role: true } } },
      }),
      db.statusEvent.findMany({
        where: { complaintId: complaint.id },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
    ]);
    res.json({ complaint, comments, timeline: events });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/transition',
  requireActive,
  validate(transitionSchema),
  async (req, res, next) => {
    try {
      const complaint = await loadComplaint(req.params.id);
      assertCanView(req.user, complaint);
      const { action, note } = req.body;
      const now = new Date();

      let data = {};
      let toStatus;

      switch (action) {
        case 'CLAIM': {
          if (!isStaff(req.user)) throw new ApiError(403, 'FORBIDDEN', 'Only wardens can claim complaints');
          if (complaint.status !== 'OPEN') throw new ApiError(409, 'INVALID_TRANSITION', `Cannot claim a ${complaint.status} complaint`);
          toStatus = 'IN_PROGRESS';
          data = { assignedToId: req.user.id };
          break;
        }
        case 'RESOLVE': {
          if (!isStaff(req.user)) throw new ApiError(403, 'FORBIDDEN', 'Only wardens can resolve complaints');
          if (complaint.status !== 'IN_PROGRESS' && complaint.status !== 'OPEN') {
            throw new ApiError(409, 'INVALID_TRANSITION', `Cannot resolve a ${complaint.status} complaint`);
          }
          if (!note) throw new ApiError(422, 'NOTE_REQUIRED', 'A resolution note is required');
          toStatus = 'RESOLVED';
          data = {
            resolutionNote: note,
            resolvedAt: now,
            assignedToId: complaint.assignedToId ?? req.user.id,
          };
          break;
        }
        case 'REJECT': {
          if (!isStaff(req.user)) throw new ApiError(403, 'FORBIDDEN', 'Only staff can reject complaints');
          if (complaint.status !== 'OPEN' && complaint.status !== 'IN_PROGRESS') {
            throw new ApiError(409, 'INVALID_TRANSITION', `Cannot reject a ${complaint.status} complaint`);
          }
          if (!note) throw new ApiError(422, 'NOTE_REQUIRED', 'A reason is required to reject');
          toStatus = 'REJECTED';
          data = { resolutionNote: note, closedAt: now };
          break;
        }
        case 'REOPEN': {
          if (complaint.status !== 'RESOLVED') {
            throw new ApiError(409, 'INVALID_TRANSITION', `Cannot reopen a ${complaint.status} complaint`);
          }
          if (!isStaff(req.user) && complaint.createdById !== req.user.id) {
            throw new ApiError(403, 'FORBIDDEN', 'Only the complaint owner can reopen it');
          }
          const hoursSince = (now - complaint.resolvedAt) / (1000 * 60 * 60);
          if (hoursSince > REOPEN_WINDOW_HOURS) {
            throw new ApiError(409, 'REOPEN_WINDOW_PASSED', 'Reopen window of 72 hours has passed');
          }
          if (complaint.reopenedCount >= MAX_REOPENS) {
            throw new ApiError(409, 'TOO_MANY_REOPENS', 'This complaint has been reopened too many times');
          }
          toStatus = 'IN_PROGRESS';
          data = {
            reopenedCount: { increment: 1 },
            resolvedAt: null,
            assignedToId: isStaff(req.user) ? (complaint.assignedToId ?? req.user.id) : complaint.assignedToId,
          };
          break;
        }
        case 'CLOSE': {
          if (complaint.status !== 'RESOLVED') {
            throw new ApiError(409, 'INVALID_TRANSITION', `Cannot close a ${complaint.status} complaint`);
          }
          if (!isStaff(req.user) && complaint.createdById !== req.user.id) {
            throw new ApiError(403, 'FORBIDDEN', 'Only the complaint owner can confirm and close it');
          }
          toStatus = 'CLOSED';
          data = { closedAt: now };
          break;
        }
        default:
          throw new ApiError(400, 'UNKNOWN_ACTION', 'Unknown transition action');
      }

      const updated = await db.$transaction(async (tx) => {
        const c = await tx.complaint.update({ where: { id: complaint.id }, data });
        await recordEvent(tx, c.id, req.user.id, complaint.status, toStatus, note ?? null);
        return c;
      });

      res.json({ complaint: updated });
    } catch (err) {
      next(err);
    }
  }
);

router.patch('/:id/assign', requireRoleStaff(), validate(assignSchema), async (req, res, next) => {
  try {
    const complaint = await loadComplaint(req.params.id);
    assertCanView(req.user, complaint);

    let assignee = null;
    if (req.body.assignedToId) {
      assignee = await db.user.findUnique({ where: { id: req.body.assignedToId } });
      if (!assignee || !isStaff(assignee)) {
        throw new ApiError(422, 'INVALID_ASSIGNEE', 'Assignee must be a warden or admin');
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const c = await tx.complaint.update({
        where: { id: complaint.id },
        data: { assignedToId: assignee?.id ?? null },
      });
      await recordEvent(
        tx,
        c.id,
        req.user.id,
        c.status,
        c.status,
        assignee ? `Assigned to ${assignee.name}` : 'Assignment cleared'
      );
      return c;
    });
    res.json({ complaint: updated });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/priority', requireRoleStaff(), validate(prioritySchema), async (req, res, next) => {
  try {
    const complaint = await loadComplaint(req.params.id);
    assertCanView(req.user, complaint);
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: { priority: req.body.priority },
    });
    res.json({ complaint: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', requireActive, validate(commentSchema), async (req, res, next) => {
  try {
    const complaint = await loadComplaint(req.params.id);
    assertCanView(req.user, complaint);
    const comment = await db.comment.create({
      data: { complaintId: complaint.id, authorId: req.user.id, body: req.body.body },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
});

function requireRoleStaff() {
  return (req, res, next) => {
    if (!isStaff(req.user)) return next(new ApiError(403, 'FORBIDDEN', 'Warden or admin access required'));
    if (req.user.status !== 'ACTIVE') return next(new ApiError(403, 'ACCOUNT_PENDING', 'Account not active'));
    next();
  };
}

module.exports = router;
