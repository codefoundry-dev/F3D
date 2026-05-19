import { z } from 'zod';

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  status: z.enum(['Pending', 'Approved', 'Disputed', 'Paid', 'Rejected']).optional(),
  projectId: z.string().uuid().optional(),
  sortBy: z.string().optional().default('dueDate'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type InvoiceListQueryValues = z.infer<typeof invoiceListQuerySchema>;
