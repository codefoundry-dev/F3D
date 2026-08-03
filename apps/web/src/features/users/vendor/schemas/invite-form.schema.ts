import { z } from 'zod';

export const inviteVendorUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  // Optional end-to-end: the API rejects an empty string, so the submit path
  // omits the field entirely when blank (FOR-289).
  position: z.string().max(255).optional(),
});

export type InviteVendorUserFormValues = z.infer<typeof inviteVendorUserSchema>;
