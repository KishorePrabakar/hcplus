const { z } = require('zod');

const CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'INTERNET',
  'MESS',
  'CLEANLINESS',
  'FURNITURE',
  'SECURITY',
  'OTHER',
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const createComplaintSchema = z.object({
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(4000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
});

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

const transitionSchema = z.object({
  action: z.enum(['CLAIM', 'RESOLVE', 'REJECT', 'REOPEN', 'CLOSE']),
  note: z.string().trim().max(2000).optional(),
});

const assignSchema = z.object({
  assignedToId: z.string().cuid().nullable(),
});

const prioritySchema = z.object({ priority: z.enum(PRIORITIES) });

const listQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED']).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = {
  CATEGORIES,
  PRIORITIES,
  createComplaintSchema,
  commentSchema,
  transitionSchema,
  assignSchema,
  prioritySchema,
  listQuerySchema,
};
