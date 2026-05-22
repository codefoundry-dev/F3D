import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ApprovalAuthorizationService } from './approval-authorization.service';

describe('ApprovalAuthorizationService', () => {
  let prisma: { rolePermission: { findFirst: jest.Mock } };
  let service: ApprovalAuthorizationService;

  beforeEach(() => {
    prisma = { rolePermission: { findFirst: jest.fn() } };
    service = new ApprovalAuthorizationService(prisma as unknown as PrismaService);
  });

  it('returns notGranted when the role does not hold the permission', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.approve', 1000);

    expect(result).toEqual({ outcome: 'notGranted' });
  });

  it('returns allowed with null threshold when the permission is not threshold-aware', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.list', 999999);

    expect(result).toEqual({ outcome: 'allowed', threshold: null });
  });

  it('returns allowed (unlimited) when the threshold column is null on a threshold-aware grant', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

    const result = await service.evaluate(
      UserRole.COMPANY_ADMIN,
      'po.approve',
      new Prisma.Decimal(1_000_000),
    );

    expect(result).toEqual({ outcome: 'allowed', threshold: null });
  });

  it('returns allowed when the amount equals the configured threshold (inclusive cap)', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.approve', 25_000);

    expect(result.outcome).toBe('allowed');
  });

  it('returns allowed when the amount is below the threshold', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.approve', 24_999.99);

    expect(result.outcome).toBe('allowed');
  });

  it('returns belowThreshold when the amount exceeds the configured threshold', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.approve', 30_000);

    expect(result.outcome).toBe('belowThreshold');
    if (result.outcome === 'belowThreshold') {
      expect(result.threshold.equals(25_000)).toBe(true);
    }
  });

  it('accepts a Decimal amount and compares against the threshold', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal('10000.00'),
    });

    const result = await service.evaluate(
      UserRole.PROCUREMENT_OFFICER,
      'po.approve',
      new Prisma.Decimal('10000.01'),
    );

    expect(result.outcome).toBe('belowThreshold');
  });

  it('returns allowed when the amount is null on a threshold-aware grant', async () => {
    // Callers that need stricter behaviour can branch on a missing amount;
    // the service itself does not invent a "missing amount" failure mode.
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(100),
    });

    const result = await service.evaluate(UserRole.PROCUREMENT_OFFICER, 'po.approve', null);

    expect(result.outcome).toBe('allowed');
  });
});
