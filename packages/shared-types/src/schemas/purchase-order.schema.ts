import { z } from 'zod';

import { PickUpTimeExpectation, PoPriority, PoSourceOfCreation, PoStatus, PoType } from '../enums';

export const poListQuerySchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
  search: z.string().optional(),
  status: z.nativeEnum(PoStatus).optional(),
  quickFilter: z.string().optional(),
  projectId: z.string().uuid().optional(),
  sortBy: z.string().optional().default('createdDate'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type PoListQueryValues = z.infer<typeof poListQuerySchema>;

export const createPoLineItemSchema = z.object({
  materialId: z.string().uuid(),
  materialCode: z.string().optional(),
  description: z.string().optional(),
  quantityOrdered: z.number().int().min(1),
  unitOfMeasure: z.string().min(1),
  unitPrice: z.number().min(0),
  costCode: z.string().optional(),
  notes: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  deliveryLocationId: z.string().uuid().optional(),
});

export const createPoDeliverySchema = z
  .object({
    deliveryLocationId: z.string().uuid().optional(),
    deliveryDate: z.string().datetime().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => Boolean(d.deliveryLocationId) || Boolean(d.deliveryDate), {
    message: 'A delivery row must have a location or a date',
  });

export const createPurchaseOrderSchema = z.object({
  projectId: z.string().uuid(),
  vendorId: z.string().uuid(),
  deliveryLocationId: z.string().uuid(),
  plannedDeliveryDate: z.string().datetime(),
  poType: z.nativeEnum(PoType).optional(),
  sourceOfCreation: z.nativeEnum(PoSourceOfCreation).optional(),
  priority: z.nativeEnum(PoPriority).optional(),
  holdForRelease: z.boolean().optional(),
  deadlineStart: z.string().datetime().optional(),
  deadlineEnd: z.string().datetime().optional(),
  pickUp: z.boolean().optional(),
  pickUpLocation: z.string().optional(),
  pickUpTimeExpectation: z.nativeEnum(PickUpTimeExpectation).optional(),
  pickUpPersonName: z.string().optional(),
  pickUpPersonPhone: z.string().optional(),
  currency: z.string().optional(),
  paymentTermsDays: z.number().int().optional(),
  costCode: z.string().optional(),
  rfqId: z.string().uuid().optional(),
  deliveryNotes: z.string().optional(),
  message: z.string().optional(),
  deliveryResponsibleName: z.string().optional(),
  deliveryResponsibleEmail: z.string().email().optional(),
  lineItems: z.array(createPoLineItemSchema).min(1),
  deliveries: z.array(createPoDeliverySchema).optional(),
});

export type CreatePurchaseOrderValues = z.infer<typeof createPurchaseOrderSchema>;

export const updatePurchaseOrderSchema = createPurchaseOrderSchema
  .omit({ projectId: true })
  .partial();

export type UpdatePurchaseOrderValues = z.infer<typeof updatePurchaseOrderSchema>;
