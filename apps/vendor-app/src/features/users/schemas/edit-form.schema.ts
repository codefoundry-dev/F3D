import { z } from 'zod';

export const editVendorUserFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().default(''),
  position: z.string().optional().default(''),
});

export type EditVendorUserFormValues = z.infer<typeof editVendorUserFormSchema>;
