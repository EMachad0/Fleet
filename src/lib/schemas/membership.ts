import { z } from 'zod';

export const roleSchema = z.enum(['owner', 'admin', 'member']);
export type Role = z.infer<typeof roleSchema>;

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'Select a user'),
  role: roleSchema,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
