import { z } from 'zod';

export const rfqListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  status: z
    .enum(['Draft', 'Open', 'AwaitingResponse', 'Quoted', 'Awarded', 'Closed', 'Cancelled'])
    .optional(),
  quickFilter: z
    .enum(['MyRfqs', 'OpenRfqs', 'AwaitingResponses', 'NoQuotes', 'AwardedRfqs', 'ClosedRfqs'])
    .optional(),
  projectId: z.string().uuid().optional(),
  sortBy: z.string().optional().default('createdDate'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  groupBy: z.string().optional(),
});

export type RfqListQueryValues = z.infer<typeof rfqListQuerySchema>;

export const createRfqLineItemSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.number().min(0.01),
  uom: z.string().min(1),
  costCode: z.string().optional(),
  notes: z.string().optional(),
  pickUp: z.boolean().optional(),
});

export const createRfqSchema = z.object({
  projectId: z.string().uuid(),
  deadlineEnd: z.string().datetime(),
  deliveryLocationId: z.string().uuid(),
  needByDate: z.string().datetime().optional(),
  holdForRelease: z.boolean().optional(),
  earliestDeliveryDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  lineItems: z.array(createRfqLineItemSchema).min(1),
  vendorIds: z.array(z.string().uuid()).min(1),
  message: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
});

export type CreateRfqValues = z.infer<typeof createRfqSchema>;

export const updateRfqSchema = createRfqSchema.partial();

export type UpdateRfqValues = z.infer<typeof updateRfqSchema>;
