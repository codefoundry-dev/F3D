import { z } from 'zod';

import { COMPANY_ROLE_OPTIONS } from '../constants/roles';

export const createUserFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  role: z.enum(COMPANY_ROLE_OPTIONS, {
    required_error: 'Role is required',
  }),
  // Position is optional per the Figma design (label shows "(optional)") and the
  // backend CreateUserDto (`position?: string`).
  position: z.string().max(255).optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>;

export const editUserFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().default(''),
  role: z.string().min(1, 'Role is required'),
  position: z.string().optional().default(''),
  department: z.string().optional().default(''),
});

export type EditUserFormValues = z.infer<typeof editUserFormSchema>;
