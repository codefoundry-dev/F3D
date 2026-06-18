import {
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
  DeliveryReportSource,
  DeliveryReportStatus,
} from '@forethread/shared-types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { PoStatusService } from '../../purchase-orders/po-status.service';
import { StorageService } from '../../storage/storage.service';
import { CreateDeliveryReportDto } from '../deliveries.dto';
import { DeliveriesService } from '../deliveries.service';

// ── Test users ────────────────────────────────────────────────────────────────
const officer: AuthenticatedUser = {
  id: 'u-1',
  email: 'po@example.com',
  role: UserRole.PROCUREMENT_OFFICER,
  companyId: 'company-1',
};
const superAdmin: AuthenticatedUser = {
  id: 'sa-1',
  email: 'sa@example.com',
  role: UserRole.SUPER_ADMIN,
  companyId: null,
};

// A deliverable PO with two tracked lines.
function deliverablePo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1',
    status: 'ACCEPTED',
    companyId: 'company-1',
    projectId: 'proj-1',
    vendorId: 'vendor-1',
    deliveryLocationId: 'loc-hdr',
    lineItems: [
      {
        id: 'li-1',
        materialId: 'mat-1',
        quantityOrdered: 100,
        quantityDelivered: 0,
        deliveryLocationId: null,
      },
      {
        id: 'li-2',
        materialId: 'mat-2',
        quantityOrdered: 60,
        quantityDelivered: 0,
        deliveryLocationId: null,
      },
    ],
    ...overrides,
  };
}

function makeService() {
  const tx = {
    deliveryReport: {
      create: jest.fn().mockResolvedValue({ id: 'dr-1' }),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const prisma = {
    deliveryReport: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    purchaseOrder: { findUnique: jest.fn() },
    rfq: { findMany: jest.fn().mockResolvedValue([]) },
    invoice: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Officer One' }) },
    // Handles both array and callback transaction forms.
    $transaction: jest.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: typeof tx) => Promise<unknown>)(tx),
    ),
  } as unknown as PrismaService & Record<string, never>;

  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService & {
    log: jest.Mock;
  };
  const storage = {
    getSignedUrl: jest.fn().mockResolvedValue('https://signed/url'),
  } as unknown as StorageService & { getSignedUrl: jest.Mock };

  const poStatus = {
    applyDeliveryDeltasInTx: jest.fn().mockResolvedValue({
      transitioned: true,
      fromStatus: 'ACCEPTED',
      nextStatus: 'PARTIALLY_DELIVERED',
    }),
    auditDeliveryTransition: jest.fn().mockResolvedValue(undefined),
  } as unknown as PoStatusService & {
    applyDeliveryDeltasInTx: jest.Mock;
    auditDeliveryTransition: jest.Mock;
  };

  const service = new DeliveriesService(prisma, audit, storage, poStatus);
  return { service, prisma, audit, storage, poStatus, tx };
}

// A fully-included report row for toDetail (get).
function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dr-1',
    reportNumber: 'DR-00001',
    status: DeliveryReportStatus.SUBMITTED,
    source: DeliveryReportSource.INTERNAL,
    purchaseOrderId: 'po-1',
    projectId: 'proj-1',
    deliveryDate: new Date('2026-06-18'),
    deliveryLocationId: 'loc-hdr',
    vendorId: 'vendor-1',
    submitterName: 'Officer One',
    submitterEmail: 'po@example.com',
    contactPerson: null,
    contactPhone: null,
    overallNotes: null,
    rejectionReason: null,
    reviewedAt: null,
    createdAt: new Date('2026-06-18'),
    updatedAt: new Date('2026-06-18'),
    purchaseOrder: { id: 'po-1', poNumber: 'PO-00001', rfqId: null },
    project: { id: 'proj-1', name: 'Alpha' },
    deliveryLocation: { id: 'loc-hdr', label: 'Gate A', address: 'Addr' },
    vendor: { id: 'vendor-1', legalName: 'VendorCo' },
    reviewer: null,
    lines: [
      {
        id: 'drl-1',
        poLineItemId: 'li-1',
        materialId: 'mat-1',
        quantityOrdered: 100,
        quantityReceived: 100,
        outcome: DeliveryOutcome.DELIVERED,
        notes: null,
        damagedQuantity: null,
        damageType: null,
        damageDisposition: null,
        material: { id: 'mat-1', name: 'Steel', uom: 'pcs' },
        poLineItem: {
          id: 'li-1',
          lineNumber: 1,
          materialCode: 'ST-01',
          description: 'Steel bars',
          unitOfMeasure: 'pcs',
          quantityOrdered: 100,
        },
        damagePhotos: [],
      },
    ],
    attachments: [],
    ...overrides,
  };
}

describe('DeliveriesService', () => {
  // ── nextReportNumber ──────────────────────────────────────────────────────────
  describe('nextReportNumber', () => {
    it('pads the sequential number with the DR- prefix', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.count as jest.Mock).mockResolvedValue(41);
      await expect(service.nextReportNumber('company-1')).resolves.toBe('DR-00042');
    });

    it('produces DR-00001 for the first report', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.count as jest.Mock).mockResolvedValue(0);
      await expect(service.nextReportNumber('company-1')).resolves.toBe('DR-00001');
    });
  });

  // ── isDeliverable ─────────────────────────────────────────────────────────────
  describe('isDeliverable', () => {
    it('accepts deliverable statuses and rejects others', () => {
      const { service } = makeService();
      expect(service.isDeliverable('ACCEPTED')).toBe(true);
      expect(service.isDeliverable('PARTIALLY_DELIVERED')).toBe(true);
      expect(service.isDeliverable('DRAFT')).toBe(false);
      expect(service.isDeliverable('CLOSED')).toBe(false);
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('returns an empty page for a non-super-admin with no company', async () => {
      const { service } = makeService();
      const noCompany = { ...officer, companyId: null };
      const res = await service.list(noCompany, {});
      expect(res.items).toEqual([]);
      expect(res.meta.total).toBe(0);
    });

    it('scopes the query to the caller company and paginates', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'dr-1',
          reportNumber: 'DR-00001',
          status: 'SUBMITTED',
          source: 'INTERNAL',
          purchaseOrderId: 'po-1',
          deliveryDate: null,
          projectId: 'proj-1',
          vendorId: 'vendor-1',
          deliveryLocationId: 'loc-1',
          submitterName: 'Jane',
          createdAt: new Date('2026-06-18'),
          purchaseOrder: { poNumber: 'PO-00001', rfqId: 'rfq-1' },
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          deliveryLocation: { label: 'Gate', address: 'Addr' },
        },
      ]);
      (prisma.deliveryReport.count as jest.Mock).mockResolvedValue(1);
      (prisma.rfq.findMany as jest.Mock).mockResolvedValue([{ id: 'rfq-1', rfqNumber: 'RFQ-9' }]);
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: 'abcdef1234567890', relatedPoId: 'po-1' },
      ]);

      const res = await service.list(officer, {
        page: 1,
        limit: 10,
        search: 'PO',
        status: DeliveryReportStatus.SUBMITTED,
      });

      const where = (prisma.deliveryReport.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.companyId).toBe('company-1');
      expect(where.OR).toBeDefined();
      expect(res.items[0].linkedRfqNumber).toBe('RFQ-9');
      expect(res.items[0].invoiceNumber).toBe('INV-ABCDEF12');
      expect(res.meta.totalPages).toBe(1);
    });

    it('does not company-scope a super admin', async () => {
      const { service, prisma } = makeService();
      await service.list(superAdmin, {});
      const where = (prisma.deliveryReport.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.companyId).toBeUndefined();
    });

    it('applies every optional filter and null-coalesces missing relations in items', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'dr-2',
          reportNumber: 'DR-00002',
          status: 'APPROVED',
          source: 'EXTERNAL',
          purchaseOrderId: 'po-2',
          deliveryDate: null,
          projectId: null,
          vendorId: null,
          deliveryLocationId: null,
          submitterName: 'Dan',
          createdAt: new Date('2026-06-18'),
          // PO with no linked RFQ → linkedRfqNumber null; no invoice → invoiceNumber null.
          purchaseOrder: { poNumber: 'PO-00002', rfqId: null },
          project: null,
          vendor: null,
          deliveryLocation: null,
        },
      ]);
      (prisma.deliveryReport.count as jest.Mock).mockResolvedValue(1);

      const res = await service.list(officer, {
        vendorId: 'vendor-1',
        source: DeliveryReportSource.EXTERNAL,
        projectId: 'proj-1',
        deliveryLocationId: 'loc-1',
      });

      const where = (prisma.deliveryReport.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.vendorId).toBe('vendor-1');
      expect(where.source).toBe('EXTERNAL');
      expect(where.projectId).toBe('proj-1');
      expect(where.deliveryLocationId).toBe('loc-1');
      expect(res.items[0].projectName).toBeNull();
      expect(res.items[0].vendorName).toBeNull();
      expect(res.items[0].deliveryLocationName).toBeNull();
      expect(res.items[0].linkedRfqNumber).toBeNull();
      expect(res.items[0].invoiceNumber).toBeNull();
    });
  });

  // ── get ─────────────────────────────────────────────────────────────────────
  describe('get', () => {
    it('throws NotFound when the report does not exist', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.get('missing', officer)).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when the company does not match', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({ companyId: 'other' }),
      );
      await expect(service.get('dr-1', officer)).rejects.toThrow(ForbiddenException);
    });

    it('serialises the detail with lineItemRef and signed attachment urls', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({
          companyId: 'company-1',
          attachments: [
            {
              id: 'att-1',
              fileId: 'f-1',
              createdAt: new Date('2026-06-18'),
              file: {
                id: 'f-1',
                filename: 'pod.pdf',
                key: 'k',
                size: 10,
                mimeType: 'application/pdf',
              },
            },
          ],
        }),
      );
      const res = await service.get('dr-1', officer);
      expect(res.reportNumber).toBe('DR-00001');
      expect(res.lines[0].lineItemRef).toBe('ST-01');
      expect(res.lines[0].materialName).toBe('Steel');
      expect(res.attachments[0].url).toBe('https://signed/url');
    });

    it('falls back to "Line N" for the ref and null url + photos when signing fails', async () => {
      const { service, prisma, storage } = makeService();
      storage.getSignedUrl.mockRejectedValue(new Error('no s3'));
      // A line with no materialCode + no material so the ref + name fall back, and a photo.
      const row = detailRow({
        companyId: 'company-1',
        lines: [
          {
            id: 'drl-1',
            poLineItemId: 'li-1',
            materialId: null,
            quantityOrdered: 100,
            quantityReceived: 100,
            outcome: DeliveryOutcome.DELIVERED,
            notes: null,
            damagedQuantity: null,
            damageType: null,
            damageDisposition: null,
            material: null,
            poLineItem: {
              id: 'li-1',
              lineNumber: 1,
              materialCode: null,
              description: 'Steel bars',
              unitOfMeasure: 'pcs',
              quantityOrdered: 100,
            },
            damagePhotos: [
              { id: 'ph-1', fileId: 'f-9', file: { id: 'f-9', filename: 'd.jpg', key: 'k9' } },
            ],
          },
        ],
      });
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(row);

      const res = await service.get('dr-1', officer);
      expect(res.lines[0].lineItemRef).toBe('Line 1');
      expect(res.lines[0].materialName).toBe('Steel bars'); // PO line description fallback
      expect(res.lines[0].damagePhotos[0].url).toBeNull();
    });

    it('surfaces the reviewer name + reviewedAt when the report has been reviewed', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({
          companyId: 'company-1',
          status: DeliveryReportStatus.APPROVED,
          reviewer: { id: 'rev-1', name: 'Reviewer Rita' },
          reviewedAt: new Date('2026-06-19'),
          contactPerson: 'Sam',
          contactPhone: '555',
          overallNotes: 'ok',
        }),
      );
      const res = await service.get('dr-1', officer);
      expect(res.reviewedByName).toBe('Reviewer Rita');
      expect(res.reviewedAt).toBe(new Date('2026-06-19').toISOString());
      expect(res.contactPerson).toBe('Sam');
    });
  });

  // ── list/get serialiser fallbacks ─────────────────────────────────────────────
  // These exercise the right-hand sides of the `?? ` fallback chains in the list +
  // detail serialisers that the happy-path fixtures (fully-populated relations)
  // never reach — keeping the module's branch coverage above the 90% gate.
  describe('serialiser fallbacks', () => {
    it('falls back to the location address when the label is null (list)', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'dr-3',
          reportNumber: 'DR-00003',
          status: 'SUBMITTED',
          source: 'INTERNAL',
          purchaseOrderId: 'po-3',
          deliveryDate: new Date('2026-06-18'),
          projectId: 'proj-1',
          vendorId: 'vendor-1',
          deliveryLocationId: 'loc-1',
          submitterName: 'Jane',
          createdAt: new Date('2026-06-18'),
          purchaseOrder: { poNumber: 'PO-00003', rfqId: 'rfq-x' },
          project: { name: 'Alpha' },
          vendor: { legalName: 'VendorCo' },
          // Label is null → name resolves to the address.
          deliveryLocation: { label: null, address: '12 Dock Rd' },
        },
      ]);
      (prisma.deliveryReport.count as jest.Mock).mockResolvedValue(1);
      // PO has an rfqId but no matching RFQ row → linkedRfqNumber null.
      (prisma.rfq.findMany as jest.Mock).mockResolvedValue([]);

      const res = await service.list(officer, {});
      expect(res.items[0].deliveryLocationName).toBe('12 Dock Rd');
      expect(res.items[0].linkedRfqNumber).toBeNull();
    });

    it('falls back to the location address when the label is null (detail)', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({
          companyId: 'company-1',
          deliveryLocation: { id: 'loc-hdr', label: null, address: '12 Dock Rd' },
        }),
      );
      const res = await service.get('dr-1', officer);
      expect(res.deliveryLocationName).toBe('12 Dock Rd');
    });

    it('null-coalesces every missing relation + date in the detail', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({
          companyId: 'company-1',
          projectId: null,
          project: null,
          deliveryDate: null,
          deliveryLocationId: null,
          deliveryLocation: null,
          vendorId: null,
          vendor: null,
          reviewer: null,
          reviewedAt: null,
        }),
      );
      const res = await service.get('dr-1', officer);
      expect(res.projectName).toBeNull();
      expect(res.deliveryDate).toBeNull();
      expect(res.deliveryLocationName).toBeNull();
      expect(res.vendorName).toBeNull();
      expect(res.reviewedByName).toBeNull();
      expect(res.reviewedAt).toBeNull();
    });

    it('falls back to the PO line uom + poLineItemId ref when no material and no materialCode/lineNumber', async () => {
      const { service, prisma } = makeService();
      // poLineItem entirely absent → lineItemRef falls all the way back to the id,
      // and material/uom fall back to empty string.
      const row = detailRow({
        companyId: 'company-1',
        lines: [
          {
            id: 'drl-9',
            poLineItemId: 'li-orphan',
            materialId: null,
            quantityOrdered: 0,
            quantityReceived: 0,
            outcome: DeliveryOutcome.NOT_DELIVERED,
            notes: null,
            damagedQuantity: null,
            damageType: null,
            damageDisposition: null,
            material: null,
            poLineItem: null,
            damagePhotos: [],
          },
        ],
      });
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(row);

      const res = await service.get('dr-1', officer);
      expect(res.lines[0].lineItemRef).toBe('li-orphan');
      expect(res.lines[0].materialName).toBe('');
      expect(res.lines[0].description).toBeNull();
      expect(res.lines[0].uom).toBe('');
    });
  });

  // ── create (INTERNAL) ─────────────────────────────────────────────────────────
  describe('create', () => {
    const dto: CreateDeliveryReportDto = {
      purchaseOrderId: 'po-1',
      lines: [{ poLineItemId: 'li-1', quantityReceived: 50, outcome: DeliveryOutcome.DELIVERED }],
    };

    it('throws NotFound when the PO does not exist', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.create(officer, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when the PO is in another company', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(
        deliverablePo({ companyId: 'other' }),
      );
      await expect(service.create(officer, dto)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a delivery against a non-deliverable PO', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(
        deliverablePo({ status: 'DRAFT' }),
      );
      await expect(service.create(officer, dto)).rejects.toThrow(BadRequestException);
    });

    it('rejects a line that does not belong to the PO', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [
            { poLineItemId: 'nope', quantityReceived: 5, outcome: DeliveryOutcome.DELIVERED },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a DAMAGED line missing damage metadata', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [{ poLineItemId: 'li-1', quantityReceived: 5, outcome: DeliveryOutcome.DAMAGED }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative received quantity', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [
            { poLineItemId: 'li-1', quantityReceived: -1, outcome: DeliveryOutcome.DELIVERED },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a DAMAGED line missing the damage type', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [
            {
              poLineItemId: 'li-1',
              quantityReceived: 5,
              outcome: DeliveryOutcome.DAMAGED,
              damagedQuantity: 2,
              damageDisposition: DamageDisposition.RETURNED,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a DAMAGED line missing the damage disposition', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [
            {
              poLineItemId: 'li-1',
              quantityReceived: 5,
              outcome: DeliveryOutcome.DAMAGED,
              damagedQuantity: 2,
              damageType: DamageType.WATER,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('still succeeds when the CREATED audit write throws (fire-and-forget)', async () => {
      const { service, prisma, audit } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({ companyId: 'company-1' }),
      );
      audit.log.mockRejectedValue(new Error('audit down'));

      await expect(service.create(officer, dto)).resolves.toBeDefined();
    });

    it('rejects a DAMAGED line whose damaged qty exceeds received', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(
        service.create(officer, {
          purchaseOrderId: 'po-1',
          lines: [
            {
              poLineItemId: 'li-1',
              quantityReceived: 5,
              outcome: DeliveryOutcome.DAMAGED,
              damagedQuantity: 9,
              damageType: DamageType.IN_TRANSIT,
              damageDisposition: DamageDisposition.RETURNED,
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a SUBMITTED report and audits CREATED', async () => {
      const { service, prisma, audit, tx } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({ companyId: 'company-1' }),
      );

      await service.create(officer, dto);

      const createArg = tx.deliveryReport.create.mock.calls[0][0];
      expect(createArg.data.status).toBe(DeliveryReportStatus.SUBMITTED);
      expect(createArg.data.source).toBe(DeliveryReportSource.INTERNAL);
      expect(createArg.data.submitterUserId).toBe('u-1');
      // ordered + material snapshot taken from the PO line
      expect(createArg.data.lines.create[0].quantityOrdered).toBe(100);
      expect(createArg.data.lines.create[0].materialId).toBe('mat-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELIVERY_REPORT_CREATED' }),
      );
    });

    it('honours explicit header fields + persists a DAMAGED line snapshot', async () => {
      const { service, prisma, tx } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({ companyId: 'company-1' }),
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // name falls back to email

      await service.create(officer, {
        purchaseOrderId: 'po-1',
        projectId: 'proj-override',
        deliveryLocationId: 'loc-override',
        vendorId: 'vendor-override',
        deliveryDate: '2026-06-19',
        contactPerson: 'Sam',
        contactPhone: '555',
        overallNotes: 'careful',
        lines: [
          {
            poLineItemId: 'li-2',
            quantityReceived: 30,
            outcome: DeliveryOutcome.DAMAGED,
            damagedQuantity: 5,
            damageType: DamageType.PACKAGING,
            damageDisposition: DamageDisposition.ACCEPTED,
            notes: 'crushed corner',
          },
        ],
      });

      const data = tx.deliveryReport.create.mock.calls[0][0].data;
      expect(data.projectId).toBe('proj-override');
      expect(data.deliveryLocationId).toBe('loc-override');
      expect(data.vendorId).toBe('vendor-override');
      expect(data.submitterName).toBe('po@example.com'); // user lookup returned null
      expect(data.lines.create[0].damagedQuantity).toBe(5);
      expect(data.lines.create[0].damageType).toBe('PACKAGING');
      expect(data.lines.create[0].damageDisposition).toBe('ACCEPTED');
    });

    it('null-coalesces project/location/vendor when neither header nor PO supply them', async () => {
      const { service, prisma, tx } = makeService();
      // PO carries no project / location / vendor and the header omits them → null.
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(
        deliverablePo({ projectId: null, deliveryLocationId: null, vendorId: null }),
      );
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        detailRow({ companyId: 'company-1' }),
      );

      await service.create(officer, dto);

      const data = tx.deliveryReport.create.mock.calls[0][0].data;
      expect(data.projectId).toBeNull();
      expect(data.deliveryLocationId).toBeNull();
      expect(data.vendorId).toBeNull();
    });

    it('rejects an empty lines array', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(service.create(officer, { purchaseOrderId: 'po-1', lines: [] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── approve: delta math + idempotency ──────────────────────────────────────────
  describe('approve', () => {
    function reportForApproval(lines: unknown[]) {
      return {
        id: 'dr-1',
        status: 'SUBMITTED',
        companyId: 'company-1',
        purchaseOrderId: 'po-1',
        lines,
      };
    }

    it('throws NotFound when the report is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.approve('missing', officer)).rejects.toThrow(NotFoundException);
    });

    it('throws Forbidden when the company does not match', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(reportForApproval([]));
      const other = { ...officer, companyId: 'other' };
      await expect(service.approve('dr-1', other)).rejects.toThrow(ForbiddenException);
    });

    it('rejects approving a non-SUBMITTED report (pre-tx guard)', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({
        ...reportForApproval([]),
        status: 'APPROVED',
      });
      await expect(service.approve('dr-1', officer)).rejects.toThrow(BadRequestException);
    });

    it('computes full received for DELIVERED, allowing over-receipt (150 > 100)', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 150,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(150);
    });

    it('contributes 0 for NOT_DELIVERED and REJECTED lines', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 10,
              outcome: 'NOT_DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
            {
              poLineItemId: 'li-2',
              quantityReceived: 10,
              outcome: 'REJECTED',
              damagedQuantity: null,
              damageDisposition: null,
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(0);
      expect(deltas.get('li-2')).toBe(0);
    });

    it('nets off the returned damaged qty (DAMAGED + RETURNED → received − damaged)', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 50,
              outcome: 'DAMAGED',
              damagedQuantity: 20,
              damageDisposition: 'RETURNED',
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(30);
    });

    it('counts the full received qty for DAMAGED + ACCEPTED (kept in stock)', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 50,
              outcome: 'DAMAGED',
              damagedQuantity: 20,
              damageDisposition: 'ACCEPTED',
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(50);
    });

    it('handles a mixed report (full + netted + zero) across lines', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 100,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
            {
              poLineItemId: 'li-2',
              quantityReceived: 40,
              outcome: 'DAMAGED',
              damagedQuantity: 10,
              damageDisposition: 'RETURNED',
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(100);
      expect(deltas.get('li-2')).toBe(30);
    });

    it('treats a missing damagedQuantity as 0 for a DAMAGED + RETURNED line (full received)', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            // damagedQuantity null → nets off nothing → full received.
            {
              poLineItemId: 'li-1',
              quantityReceived: 40,
              outcome: 'DAMAGED',
              damagedQuantity: null,
              damageDisposition: 'RETURNED',
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);
      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(40);
    });

    it('accumulates multiple report lines that target the same PO line', async () => {
      const { service, prisma, poStatus } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 30,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
            {
              poLineItemId: 'li-1',
              quantityReceived: 20,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);
      const deltas = poStatus.applyDeliveryDeltasInTx.mock.calls[0][2] as Map<string, number>;
      expect(deltas.get('li-1')).toBe(50);
    });

    it('is idempotent: a concurrent double-approve is defeated by the in-tx re-read', async () => {
      const { service, prisma, poStatus, tx } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        reportForApproval([
          {
            poLineItemId: 'li-1',
            quantityReceived: 100,
            outcome: 'DELIVERED',
            damagedQuantity: null,
            damageDisposition: null,
          },
        ]),
      );
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      // The in-transaction re-read finds the report already APPROVED.
      tx.deliveryReport.findUnique.mockResolvedValue({ status: 'APPROVED' });

      await expect(service.approve('dr-1', officer)).rejects.toThrow(BadRequestException);
      expect(poStatus.applyDeliveryDeltasInTx).not.toHaveBeenCalled();
      expect(tx.deliveryReport.update).not.toHaveBeenCalled();
    });

    it('marks the report APPROVED and audits both PO transition + report', async () => {
      const { service, prisma, poStatus, audit, tx } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 100,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
          ]),
        )
        .mockResolvedValueOnce(
          detailRow({ companyId: 'company-1', status: DeliveryReportStatus.APPROVED }),
        );
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      await service.approve('dr-1', officer);

      expect(tx.deliveryReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeliveryReportStatus.APPROVED,
            reviewedByUserId: 'u-1',
          }),
        }),
      );
      expect(poStatus.auditDeliveryTransition).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELIVERY_REPORT_APPROVED' }),
      );
    });

    it('allows a super admin to approve a report from any company', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          reportForApproval([
            {
              poLineItemId: 'li-1',
              quantityReceived: 100,
              outcome: 'DELIVERED',
              damagedQuantity: null,
              damageDisposition: null,
            },
          ]),
        )
        .mockResolvedValueOnce(detailRow({ companyId: 'company-1' }));
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());
      await expect(service.approve('dr-1', superAdmin)).resolves.toBeDefined();
    });

    it('throws NotFound when the linked PO is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(
        reportForApproval([
          {
            poLineItemId: 'li-1',
            quantityReceived: 100,
            outcome: 'DELIVERED',
            damagedQuantity: null,
            damageDisposition: null,
          },
        ]),
      );
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.approve('dr-1', officer)).rejects.toThrow(NotFoundException);
    });
  });

  // ── reject ──────────────────────────────────────────────────────────────────
  describe('reject', () => {
    it('throws NotFound when the report is missing', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.reject('missing', 'bad', officer)).rejects.toThrow(NotFoundException);
    });

    it('rejects a non-SUBMITTED report', async () => {
      const { service, prisma } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock).mockResolvedValue({
        id: 'dr-1',
        status: 'APPROVED',
        companyId: 'company-1',
        purchaseOrderId: 'po-1',
      });
      await expect(service.reject('dr-1', 'bad', officer)).rejects.toThrow(BadRequestException);
    });

    it('records the rejection without touching the PO or inventory', async () => {
      const { service, prisma, poStatus, audit } = makeService();
      (prisma.deliveryReport.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: 'dr-1',
          status: 'SUBMITTED',
          companyId: 'company-1',
          purchaseOrderId: 'po-1',
        })
        .mockResolvedValueOnce(
          detailRow({ companyId: 'company-1', status: DeliveryReportStatus.REJECTED }),
        );

      await service.reject('dr-1', 'Wrong items', officer);

      expect(prisma.deliveryReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: DeliveryReportStatus.REJECTED,
            rejectionReason: 'Wrong items',
          }),
        }),
      );
      expect(poStatus.applyDeliveryDeltasInTx).not.toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELIVERY_REPORT_REJECTED' }),
      );
    });
  });

  // ── createReport (portal/EXTERNAL path) ────────────────────────────────────────
  describe('createReport (EXTERNAL, no auth user)', () => {
    it('creates an EXTERNAL report with a null submitter user and skips the audit', async () => {
      const { service, prisma, audit, tx } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(deliverablePo());

      const id = await service.createReport(
        DeliveryReportSource.EXTERNAL,
        { userId: null, name: 'Driver Dan', email: 'dan@haul.com' },
        'po-1',
        { overallNotes: 'left at gate' },
        [{ poLineItemId: 'li-1', quantityReceived: 20, outcome: DeliveryOutcome.DELIVERED }],
      );

      expect(id).toBe('dr-1');
      const createArg = tx.deliveryReport.create.mock.calls[0][0];
      expect(createArg.data.source).toBe(DeliveryReportSource.EXTERNAL);
      expect(createArg.data.submitterUserId).toBeNull();
      expect(createArg.data.submitterName).toBe('Driver Dan');
      // No performer → no audit row fabricated.
      expect(audit.log).not.toHaveBeenCalled();
    });
  });
});
