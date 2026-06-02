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

// ── Draft save-as-you-go (FOR-202) ──────────────────────────────────────────
// Mirrors SaveRfqDraftDto: projectId required, everything else optional so a
// partial draft can be persisted between steps.
export const saveRfqDraftSchema = z.object({
  projectId: z.string().uuid(),
  deadlineEnd: z.string().datetime().optional(),
  deliveryLocationId: z.string().uuid().optional(),
  needByDate: z.string().datetime().optional(),
  holdForRelease: z.boolean().optional(),
  earliestDeliveryDate: z.string().datetime().optional(),
  currency: z.string().optional(),
  lineItems: z.array(createRfqLineItemSchema).optional(),
  vendorIds: z.array(z.string().uuid()).optional(),
  message: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
});

export type SaveRfqDraftValues = z.infer<typeof saveRfqDraftSchema>;

// ── Send RFQ (FOR-203) ──────────────────────────────────────────────────────
// Optional CC recipients copied on the outbound vendor emails when the RFQ is
// sent. Attachments travel from the RFQ's uploaded documents, so they are not
// part of this payload.
export const sendRfqSchema = z.object({
  cc: z.array(z.string().email()).optional(),
});

export type SendRfqValues = z.infer<typeof sendRfqSchema>;

// ── Per-step schemas (multi-step create form, FOR-202) ──────────────────────
// Each step validates only its own slice before the user may advance.

/** Step 1 — Project */
export const rfqStepProjectSchema = z.object({
  projectId: z.string().uuid({ message: 'Select a project' }),
});

/** Step 2 — Materials */
export const rfqStepMaterialsSchema = z.object({
  lineItems: z.array(createRfqLineItemSchema).min(1, { message: 'Add at least one material' }),
});

/** Step 3 — Vendors */
export const rfqStepVendorsSchema = z.object({
  vendorIds: z.array(z.string().uuid()).min(1, { message: 'Invite at least one vendor' }),
});

/** Step 4 — Delivery & specs */
export const rfqStepDeliverySchema = z
  .object({
    deadlineEnd: z.string().datetime({ message: 'Set a response deadline' }),
    deliveryLocationId: z.string().uuid({ message: 'Select a delivery location' }),
    needByDate: z.string().datetime().optional(),
    holdForRelease: z.boolean().optional(),
    earliestDeliveryDate: z.string().datetime().optional(),
    currency: z.string().optional(),
    message: z.string().optional(),
  })
  .refine((v) => !v.holdForRelease || !!v.earliestDeliveryDate, {
    message: 'Hold-for-release requires an earliest delivery date',
    path: ['earliestDeliveryDate'],
  });

export type RfqStepProjectValues = z.infer<typeof rfqStepProjectSchema>;
export type RfqStepMaterialsValues = z.infer<typeof rfqStepMaterialsSchema>;
export type RfqStepVendorsValues = z.infer<typeof rfqStepVendorsSchema>;
export type RfqStepDeliveryValues = z.infer<typeof rfqStepDeliverySchema>;
