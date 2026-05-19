import { z } from 'zod';

export const bulkOrderListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  projectId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  sortBy: z.string().optional().default('date'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type BulkOrderListQueryValues = z.infer<typeof bulkOrderListQuerySchema>;

export const createBulkOrderLineItemSchema = z.object({
  itemReference: z.string().min(1),
  description: z.string().min(1),
  qty: z.coerce.number().int().min(1),
  unit: z.string().min(1),
  pricePerUnit: z.coerce.number().min(0),
});

export const createBulkOrderSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid(),
  rfqId: z.string().uuid().optional(),
  brands: z.string().optional(),
  endDate: z.string().optional(),
  lineItems: z.array(createBulkOrderLineItemSchema).min(1),
});

export type CreateBulkOrderValues = z.infer<typeof createBulkOrderSchema>;

export const updateBulkOrderSchema = z.object({
  brands: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED']).optional(),
});

export type UpdateBulkOrderValues = z.infer<typeof updateBulkOrderSchema>;

export const updateBulkOrderLineItemSchema = z.object({
  itemReference: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  qty: z.coerce.number().int().min(1).optional(),
  unit: z.string().min(1).optional(),
  pricePerUnit: z.coerce.number().min(0).optional(),
});

export type UpdateBulkOrderLineItemValues = z.infer<typeof updateBulkOrderLineItemSchema>;

export const createDrawdownSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  lineItemId: z.string().uuid(),
  purchaseOrderId: z.string().uuid().optional(),
});

export type CreateDrawdownValues = z.infer<typeof createDrawdownSchema>;
