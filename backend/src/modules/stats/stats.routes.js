const express = require('express');
const db = require('../../db');
const { requireAuth, requireActiveStaff } = require('../../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

function groupCount(rows, key) {
  return rows.reduce((acc, r) => {
    acc[r[key]] = r._count[key];
    return acc;
  }, {});
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const isStudent = req.user.role === 'STUDENT';
    const scope = isStudent ? { createdById: req.user.id } : {};

    const [byStatus, byPriority] = await Promise.all([
      db.complaint.groupBy({ by: ['status'], where: scope, _count: { status: true } }),
      db.complaint.groupBy({ by: ['priority'], where: { ...scope, status: { in: ['OPEN', 'IN_PROGRESS'] } }, _count: { priority: true } }),
    ]);

    const payload = {
      role: req.user.role,
      byStatus: groupCount(byStatus, 'status'),
      activeByPriority: groupCount(byPriority, 'priority'),
    };

    if (isStudent) {
      payload.recent = await db.complaint.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, code: true, title: true, status: true, priority: true, createdAt: true },
      });
    } else {
      const [byCategory, urgentOpen, pendingUsers, assignedToMe] = await Promise.all([
        db.complaint.groupBy({ by: ['category'], where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, _count: { category: true } }),
        db.complaint.count({ where: { priority: 'URGENT', status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        db.user.count({ where: { role: 'STUDENT', status: 'PENDING' } }),
        db.complaint.count({ where: { assignedToId: req.user.id, status: 'IN_PROGRESS' } }),
      ]);
      payload.byCategory = groupCount(byCategory, 'category');
      payload.urgentOpen = urgentOpen;
      payload.pendingApprovals = pendingUsers;
      payload.assignedToMe = assignedToMe;
    }

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
