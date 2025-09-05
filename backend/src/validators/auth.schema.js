const { z } = require('zod');

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[a-zA-Z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number');

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
  hostel: z.string().trim().min(2).max(80).optional(),
  roomNumber: z.string().trim().min(1).max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const inviteAcceptSchema = z.object({ password: passwordSchema });

module.exports = { registerSchema, loginSchema, inviteAcceptSchema, passwordSchema };
