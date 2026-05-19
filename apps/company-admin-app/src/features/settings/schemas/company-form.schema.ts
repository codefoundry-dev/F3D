import { z } from 'zod';

export const editCompanySchema = z.object({
  legalName: z.string().min(1, 'Name is required'),
  tradeName: z.string().optional(),
  abn: z
    .string()
    .regex(/^\d{11}$/, 'ABN must be exactly 11 digits')
    .optional()
    .or(z.literal('')),
  taxCode: z
    .string()
    .regex(/^\d{9}$/, 'Tax code must be exactly 9 digits')
    .optional()
    .or(z.literal('')),
  legalAddress: z.string().optional(),
  contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  website: z.string().optional(),
});

export type EditCompanyFormData = z.infer<typeof editCompanySchema>;
