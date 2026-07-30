import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ApprovalAuthorizationService } from './approval-authorization.service';

describe('ApprovalAuthorizationService', () => {
  let prisma: {
    rolePermission: { findFirst: jest.Mock; findMany: jest.Mock };
    customRolePermission: { findFirst: jest.Mock; findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let service: ApprovalAuthorizationService;

  beforeEach(() => {
    prisma = {
      rolePermission: { findFirst: jest.fn(), findMany: jest.fn() },
      customRolePermission: { findFirst: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    service = new ApprovalAuthorizationService(prisma as unknown as PrismaService);
  });

  it('returns notGranted when the role does not hold the permission', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.approve',
      1000,
    );

    expect(result).toEqual({ outcome: 'notGranted' });
  });

  it('returns allowed with null threshold when the permission is not threshold-aware', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.list',
      999999,
    );

    expect(result).toEqual({ outcome: 'allowed', threshold: null });
  });

  it('returns allowed (unlimited) when the threshold column is null on a threshold-aware grant', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

    const result = await service.evaluate(
      { role: UserRole.COMPANY_ADMIN },
      'po.approve',
      new Prisma.Decimal(1_000_000),
    );

    expect(result).toEqual({ outcome: 'allowed', threshold: null });
  });

  it('returns allowed when the amount equals the configured threshold (inclusive cap)', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.approve',
      25_000,
    );

    expect(result.outcome).toBe('allowed');
  });

  it('returns allowed when the amount is below the threshold', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.approve',
      24_999.99,
    );

    expect(result.outcome).toBe('allowed');
  });

  it('returns belowThreshold when the amount exceeds the configured threshold', async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({
      thresholdAmount: new Prisma.Decimal(25_000),
    });

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.approve',
      30_000,
    );

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
      { role: UserRole.PROCUREMENT_OFFICER },
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

    const result = await service.evaluate(
      { role: UserRole.PROCUREMENT_OFFICER },
      'po.approve',
      null,
    );

    expect(result.outcome).toBe('allowed');
  });

  describe('custom-role assignment (FOR-253)', () => {
    it('resolves the grant from the custom role instead of the built-in role', async () => {
      prisma.customRolePermission.findFirst.mockResolvedValue({
        thresholdAmount: new Prisma.Decimal(5_000),
      });

      const result = await service.evaluate(
        { role: UserRole.PROCUREMENT_OFFICER, customRoleId: 'cr-1' },
        'po.approve',
        6_000,
      );

      expect(result.outcome).toBe('belowThreshold');
      expect(prisma.customRolePermission.findFirst).toHaveBeenCalledWith({
        where: { customRoleId: 'cr-1', permission: { key: 'po.approve' } },
        select: { thresholdAmount: true },
      });
      expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
    });

    it('returns notGranted when the custom role lacks the permission, even if the built-in role has it', async () => {
      prisma.customRolePermission.findFirst.mockResolvedValue(null);
      prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

      const result = await service.evaluate(
        { role: UserRole.COMPANY_ADMIN, customRoleId: 'cr-1' },
        'po.approve',
        100,
      );

      expect(result).toEqual({ outcome: 'notGranted' });
      expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
    });

    it('ignores a custom role on a SUPER_ADMIN actor', async () => {
      prisma.rolePermission.findFirst.mockResolvedValue({ thresholdAmount: null });

      const result = await service.evaluate(
        { role: UserRole.SUPER_ADMIN, customRoleId: 'cr-1' },
        'po.approve',
        1_000_000,
      );

      expect(result.outcome).toBe('allowed');
      expect(prisma.customRolePermission.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('findEligibleApproverEmails (FOR-286 routing)', () => {
    const user = (
      email: string,
      role: UserRole = UserRole.PROCUREMENT_OFFICER,
      customRoleId: string | null = null,
    ) => ({ email, role, customRoleId });

    beforeEach(() => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.customRolePermission.findMany.mockResolvedValue([]);
    });

    it('returns users whose built-in role grant covers the amount, excluding over-limit roles', async () => {
      prisma.user.findMany.mockResolvedValue([
        user('officer@test.com', UserRole.PROCUREMENT_OFFICER),
        user('admin@test.com', UserRole.COMPANY_ADMIN),
      ]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.PROCUREMENT_OFFICER, thresholdAmount: new Prisma.Decimal(10_000) },
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: null },
      ]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 30_000);

      expect(result).toEqual(['admin@test.com']);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { companyId: 'comp-1', status: 'ACTIVE' },
        select: { email: true, role: true, customRoleId: true },
      });
    });

    it('includes a user whose assigned custom role covers the amount even when the built-in role has no grant', async () => {
      prisma.user.findMany.mockResolvedValue([user('senior@test.com', UserRole.FOREMAN, 'cr-1')]);
      prisma.customRolePermission.findMany.mockResolvedValue([
        { customRoleId: 'cr-1', thresholdAmount: new Prisma.Decimal(50_000) },
      ]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 30_000);

      expect(result).toEqual(['senior@test.com']);
      expect(prisma.customRolePermission.findMany).toHaveBeenCalledWith({
        where: { customRoleId: { in: ['cr-1'] }, permission: { key: 'po.approve' } },
        select: { customRoleId: true, thresholdAmount: true },
      });
    });

    it('excludes a user whose custom role lacks the grant even when their built-in role covers it', async () => {
      // Custom-role-first is replacement, not union (FOR-253) — the assigned
      // role's missing/short grant must not fall back to the built-in role's.
      prisma.user.findMany.mockResolvedValue([
        user('capped@test.com', UserRole.COMPANY_ADMIN, 'cr-junior'),
      ]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: null },
      ]);
      prisma.customRolePermission.findMany.mockResolvedValue([]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 30_000);

      expect(result).toEqual([]);
    });

    it('excludes a custom-role holder whose cap is below the amount', async () => {
      prisma.user.findMany.mockResolvedValue([
        user('junior@test.com', UserRole.PROCUREMENT_OFFICER, 'cr-junior'),
      ]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.PROCUREMENT_OFFICER, thresholdAmount: null },
      ]);
      prisma.customRolePermission.findMany.mockResolvedValue([
        { customRoleId: 'cr-junior', thresholdAmount: new Prisma.Decimal(5_000) },
      ]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 30_000);

      expect(result).toEqual([]);
    });

    it('treats an amount equal to the cap as covered (inclusive), and a null amount as within every cap', async () => {
      prisma.user.findMany.mockResolvedValue([user('officer@test.com')]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.PROCUREMENT_OFFICER, thresholdAmount: new Prisma.Decimal(25_000) },
      ]);

      await expect(
        service.findEligibleApproverEmails('comp-1', 'po.approve', new Prisma.Decimal(25_000)),
      ).resolves.toEqual(['officer@test.com']);
      await expect(
        service.findEligibleApproverEmails('comp-1', 'po.approve', null),
      ).resolves.toEqual(['officer@test.com']);
    });

    it('short-circuits without grant queries when the company has no active users', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 1_000);

      expect(result).toEqual([]);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });

    it('skips the custom-grant query when no user holds a custom role, and dedupes emails', async () => {
      prisma.user.findMany.mockResolvedValue([
        user('dup@test.com', UserRole.COMPANY_ADMIN),
        user('dup@test.com', UserRole.COMPANY_ADMIN),
      ]);
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, thresholdAmount: null },
      ]);

      const result = await service.findEligibleApproverEmails('comp-1', 'po.approve', 1_000);

      expect(result).toEqual(['dup@test.com']);
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });
  });
});
