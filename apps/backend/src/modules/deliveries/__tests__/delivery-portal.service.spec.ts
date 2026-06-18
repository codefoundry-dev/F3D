import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccessTokenPurpose, AccessTokenSubject, type AccessToken } from '@prisma/client';
import { DeliveryOutcome } from '@forethread/shared-types';

import { PrismaService } from '../../../prisma/prisma.service';
import { AccessTokensService } from '../../access-tokens/access-tokens.service';
import { EmailService } from '../../notifications/email.service';
import { DeliveriesService } from '../deliveries.service';
import { DeliveryCodeService } from '../delivery-code.service';
import { DeliveryPortalService } from '../delivery-portal.service';
import { PortalSubmitDto } from '../deliveries.dto';

function makeService() {
  const prisma = {
    purchaseOrder: { findUnique: jest.fn() },
    accessToken: { update: jest.fn().mockResolvedValue({}) },
    deliveryReport: { findUniqueOrThrow: jest.fn().mockResolvedValue({ reportNumber: 'DR-00001' }) },
  } as unknown as PrismaService & Record<string, never>;

  const accessTokens = {
    issueToken: jest.fn().mockResolvedValue({ token: 'sess.secret', record: { id: 'tok-1' } }),
    consumeToken: jest.fn().mockResolvedValue({}),
  } as unknown as AccessTokensService & { issueToken: jest.Mock; consumeToken: jest.Mock };

  const deliveryCode = {
    generateAndStore: jest.fn().mockResolvedValue({ code: '123456', expiresAt: new Date(Date.now() + 60000) }),
    verifyCode: jest.fn().mockResolvedValue(true),
  } as unknown as DeliveryCodeService & { generateAndStore: jest.Mock; verifyCode: jest.Mock };

  const emailService = {
    sendDeliveryCodeEmail: jest.fn().mockResolvedValue(undefined),
  } as unknown as EmailService & { sendDeliveryCodeEmail: jest.Mock };

  const deliveriesService = {
    createReport: jest.fn().mockResolvedValue('dr-1'),
  } as unknown as DeliveriesService & { createReport: jest.Mock };

  const service = new DeliveryPortalService(
    prisma,
    accessTokens,
    deliveryCode,
    emailService,
    deliveriesService,
  );
  return { service, prisma, accessTokens, deliveryCode, emailService, deliveriesService };
}

function sessionToken(metadata: Record<string, unknown> | null): AccessToken {
  return {
    id: 'tok-1',
    subjectId: 'po-1',
    subjectType: AccessTokenSubject.PURCHASE_ORDER,
    purpose: AccessTokenPurpose.DELIVERY_SESSION,
    metadata,
  } as unknown as AccessToken;
}

describe('DeliveryPortalService', () => {
  // ── getPortalPo ────────────────────────────────────────────────────────────────
  describe('getPortalPo', () => {
    it('throws Forbidden when the PO is gone', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.getPortalPo('po-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns the read-only PO header + lines', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        poNumber: 'PO-00001',
        plannedDeliveryDate: new Date('2026-06-20'),
        project: { name: 'Alpha' },
        vendor: { legalName: 'VendorCo' },
        deliveryLocation: { label: 'Gate', address: 'Addr' },
        lineItems: [
          {
            id: 'li-1',
            lineNumber: 1,
            materialCode: 'ST-01',
            description: 'Steel',
            unitOfMeasure: 'pcs',
            quantityOrdered: 100,
            material: { name: 'Steel bar' },
          },
        ],
      });

      const res = await service.getPortalPo('po-1');
      expect(res.poNumber).toBe('PO-00001');
      expect(res.lines[0].id).toBe('li-1');
      expect(res.lines[0].lineItemRef).toBe('ST-01');
      expect(res.lines[0].materialName).toBe('Steel bar');
    });

    it('null-coalesces missing project/vendor/location and falls back the line ref', async () => {
      const { service, prisma } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({
        poNumber: 'PO-00002',
        plannedDeliveryDate: null,
        project: null,
        vendor: null,
        deliveryLocation: null,
        lineItems: [
          {
            id: 'li-9',
            lineNumber: 3,
            materialCode: null,
            description: 'Free-text item',
            unitOfMeasure: 'm',
            quantityOrdered: 5,
            material: null,
          },
        ],
      });

      const res = await service.getPortalPo('po-1');
      expect(res.projectName).toBeNull();
      expect(res.vendorName).toBeNull();
      expect(res.deliveryLocationName).toBeNull();
      expect(res.deliveryDate).toBeNull();
      expect(res.lines[0].lineItemRef).toBe('Line 3');
      expect(res.lines[0].materialName).toBe('Free-text item');
    });
  });

  // ── identify (anti-enumeration) ────────────────────────────────────────────────
  describe('identify', () => {
    it('emails a code and returns ok when the PO exists', async () => {
      const { service, prisma, deliveryCode, emailService } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({ poNumber: 'PO-00001' });

      await expect(service.identify('po-1', 'Dan', 'dan@x.com')).resolves.toEqual({ ok: true });
      expect(deliveryCode.generateAndStore).toHaveBeenCalledWith('po-1', 'dan@x.com');
      expect(emailService.sendDeliveryCodeEmail).toHaveBeenCalled();
    });

    it('returns ok WITHOUT sending when the PO does not exist (anti-enumeration)', async () => {
      const { service, prisma, deliveryCode, emailService } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.identify('po-x', 'Dan', 'dan@x.com')).resolves.toEqual({ ok: true });
      expect(deliveryCode.generateAndStore).not.toHaveBeenCalled();
      expect(emailService.sendDeliveryCodeEmail).not.toHaveBeenCalled();
    });

    it('swallows downstream errors and still returns ok', async () => {
      const { service, prisma, deliveryCode } = makeService();
      (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue({ poNumber: 'PO-00001' });
      deliveryCode.generateAndStore.mockRejectedValue(new Error('smtp down'));

      await expect(service.identify('po-1', 'Dan', 'dan@x.com')).resolves.toEqual({ ok: true });
    });
  });

  // ── verify ─────────────────────────────────────────────────────────────────────
  describe('verify', () => {
    it('mints a DELIVERY_SESSION token carrying email + name on a correct code', async () => {
      const { service, accessTokens } = makeService();
      const res = await service.verify('po-1', 'dan@x.com', '123456', 'Dan');

      expect(res.sessionToken).toBe('sess.secret');
      const arg = accessTokens.issueToken.mock.calls[0][0];
      expect(arg.purpose).toBe(AccessTokenPurpose.DELIVERY_SESSION);
      expect(arg.subjectId).toBe('po-1');
      expect(arg.metadata).toEqual({ email: 'dan@x.com', name: 'Dan' });
    });

    it('throws 400 on an incorrect code (no token minted)', async () => {
      const { service, accessTokens, deliveryCode } = makeService();
      deliveryCode.verifyCode.mockResolvedValue(false);

      await expect(service.verify('po-1', 'dan@x.com', '000000', 'Dan')).rejects.toThrow(
        BadRequestException,
      );
      expect(accessTokens.issueToken).not.toHaveBeenCalled();
    });
  });

  // ── submit ─────────────────────────────────────────────────────────────────────
  describe('submit', () => {
    const dto: PortalSubmitDto = {
      overallNotes: 'left at dock',
      lines: [{ poLineItemId: 'li-1', quantityReceived: 10, outcome: DeliveryOutcome.DELIVERED }],
    };

    it('creates an EXTERNAL report from the token identity and stamps the report id', async () => {
      const { service, deliveriesService, prisma } = makeService();
      const token = sessionToken({ email: 'dan@x.com', name: 'Dan' });

      const res = await service.submit(token, dto);

      expect(res).toEqual({ deliveryReportId: 'dr-1', reportNumber: 'DR-00001' });
      const callArgs = deliveriesService.createReport.mock.calls[0];
      expect(callArgs[0]).toBe('EXTERNAL');
      expect(callArgs[1]).toEqual({ userId: null, name: 'Dan', email: 'dan@x.com' });
      expect(callArgs[2]).toBe('po-1');
      // The session token metadata is updated with the new report id.
      const updateArg = (prisma.accessToken.update as jest.Mock).mock.calls[0][0];
      expect(updateArg.data.metadata).toMatchObject({ deliveryReportId: 'dr-1' });
    });

    it('throws Forbidden when the session token has no submitter metadata', async () => {
      const { service } = makeService();
      await expect(service.submit(sessionToken(null), dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws Forbidden when metadata is missing required fields', async () => {
      const { service } = makeService();
      await expect(service.submit(sessionToken({ email: 'x@x.com' }), dto)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── finalize ─────────────────────────────────────────────────────────────────
  describe('finalize', () => {
    it('consumes the session token', async () => {
      const { service, accessTokens } = makeService();
      await expect(service.finalize(sessionToken({ email: 'a', name: 'b' }))).resolves.toEqual({
        ok: true,
      });
      expect(accessTokens.consumeToken).toHaveBeenCalledWith('tok-1');
    });
  });

  // ── resolveSessionReportId ─────────────────────────────────────────────────────
  describe('resolveSessionReportId', () => {
    it('returns the stamped report id', () => {
      const { service } = makeService();
      const id = service.resolveSessionReportId(
        sessionToken({ email: 'a', name: 'b', deliveryReportId: 'dr-7' }),
      );
      expect(id).toBe('dr-7');
    });

    it('throws Forbidden when no report has been submitted yet on the session', () => {
      const { service } = makeService();
      expect(() => service.resolveSessionReportId(sessionToken({ email: 'a', name: 'b' }))).toThrow(
        ForbiddenException,
      );
    });
  });
});
