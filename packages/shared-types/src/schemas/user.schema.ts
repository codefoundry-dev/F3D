import { z } from 'zod';

import { UserRole, CompanyType } from '../enums';

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid role' }) }),
  companyId: z.string().uuid('Invalid company ID'),
  companyType: z.nativeEnum(CompanyType).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.nativeEnum(UserRole).optional(),
  position: z.string().max(255).optional(),
});

export const updateMeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  position: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one digit',
      ),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  });

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
export type UpdateMeFormValues = z.infer<typeof updateMeSchema>;
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
