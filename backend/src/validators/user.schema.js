const { z } = require('zod');

const statusActionSchema = z.object({
  action: z.enum(['APPROVE', 'SUSPEND', 'REACTIVATE', 'REJECT']),
});

const staffCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  role: z.enum(['WARDEN', 'ADMIN']),
});

const roleChangeSchema = z.object({
  role: z.enum(['STUDENT', 'WARDEN', 'ADMIN']),
});

const bulkRowSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email(),
  hostel: z.string().trim().min(1).max(80).optional(),
  roomNumber: z.string().trim().max(20).optional(),
});

const bulkInviteSchema = z.object({ rows: z.array(bulkRowSchema).min(1).max(500) });

const inviteCreateSchema = bulkRowSchema.extend({
  name: z.string().trim().min(2).max(80),
  role: z.enum(['STUDENT', 'WARDEN']).default('STUDENT'),
});

module.exports = {
  statusActionSchema,
  staffCreateSchema,
  roleChangeSchema,
  bulkInviteSchema,
  inviteCreateSchema,
};
