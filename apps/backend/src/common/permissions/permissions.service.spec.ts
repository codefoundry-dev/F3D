import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    rolePermission: { findMany: jest.Mock; count: jest.Mock };
    customRolePermission: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      rolePermission: { findMany: jest.fn(), count: jest.fn() },
      customRolePermission: { findMany: jest.fn(), count: jest.fn() },
    };
    service = new PermissionsService(prisma as unknown as PrismaService);
  });

  describe('getPermissionsForRole', () => {
    it('returns the set of permission keys granted to a role', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { key: 'rfq.create' } },
        { permission: { key: 'rfq.read' } },
      ]);

      const result = await service.getPermissionsForRole(UserRole.COMPANY_ADMIN);

      expect(result).toEqual(new Set(['rfq.create', 'rfq.read']));
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
        where: { role: UserRole.COMPANY_ADMIN },
        select: { permission: { select: { key: true } } },
      });
    });

    it('returns an empty set when the role has no permissions', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      const result = await service.getPermissionsForRole(UserRole.FOREMAN);
      expect(result.size).toBe(0);
    });
  });

  describe('roleHasPermission', () => {
    it('returns true when the role row exists for the key', async () => {
      prisma.rolePermission.count.mockResolvedValue(1);
      await expect(service.roleHasPermission(UserRole.VENDOR, 'rfq.submitQuote')).resolves.toBe(
        true,
      );
    });

    it('returns false when no row exists', async () => {
      prisma.rolePermission.count.mockResolvedValue(0);
      await expect(service.roleHasPermission(UserRole.VENDOR, 'po.approve')).resolves.toBe(false);
    });
  });

  describe('getPermissionsForUser (FOR-253)', () => {
    it('resolves via the built-in role when no custom role is assigned', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([{ permission: { key: 'rfq.create' } }]);

      const result = await service.getPermissionsForUser({ role: UserRole.FOREMAN });

      expect(result).toEqual(new Set(['rfq.create']));
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });

    it('resolves via the custom role INSTEAD of the built-in role when assigned', async () => {
      prisma.customRolePermission.findMany.mockResolvedValue([
        { permission: { key: 'po.read' } },
        { permission: { key: 'po.approve' } },
      ]);

      const result = await service.getPermissionsForUser({
        role: UserRole.FOREMAN,
        customRoleId: 'cr-1',
      });

      expect(result).toEqual(new Set(['po.read', 'po.approve']));
      expect(prisma.customRolePermission.findMany).toHaveBeenCalledWith({
        where: { customRoleId: 'cr-1' },
        select: { permission: { select: { key: true } } },
      });
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('ignores a custom role on a SUPER_ADMIN user', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([{ permission: { key: 'user.list' } }]);

      const result = await service.getPermissionsForUser({
        role: UserRole.SUPER_ADMIN,
        customRoleId: 'cr-1',
      });

      expect(result).toEqual(new Set(['user.list']));
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('filterActorsWithPermission (FOR-351)', () => {
    it('returns an empty list without querying when there are no actors', async () => {
      await expect(service.filterActorsWithPermission([], 'rfq.read')).resolves.toEqual([]);
      expect(prisma.rolePermission.findMany).not.toHaveBeenCalled();
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });

    it('keeps actors whose role grants the key and drops the rest', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN },
        { role: UserRole.PROCUREMENT_OFFICER },
      ]);

      const officer = { id: 'u1', role: UserRole.PROCUREMENT_OFFICER, customRoleId: null };
      const foreman = { id: 'u2', role: UserRole.FOREMAN, customRoleId: null };

      const result = await service.filterActorsWithPermission([officer, foreman], 'rfq.read');

      expect(result).toEqual([officer]);
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({
        where: { permission: { key: 'rfq.read' } },
        select: { role: true },
      });
      // No custom roles in the batch → the custom-role query is skipped.
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });

    it('resolves custom-role actors via their custom role INSTEAD of the built-in role', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([{ role: UserRole.PROCUREMENT_OFFICER }]);
      prisma.customRolePermission.findMany.mockResolvedValue([{ customRoleId: 'cr-granted' }]);

      // Built-in FOREMAN lacks rfq.read but their custom role grants it; the
      // officer's custom role does NOT grant it, overriding their built-in role.
      const foremanWithGrant = { id: 'u1', role: UserRole.FOREMAN, customRoleId: 'cr-granted' };
      const officerWithout = {
        id: 'u2',
        role: UserRole.PROCUREMENT_OFFICER,
        customRoleId: 'cr-denied',
      };

      const result = await service.filterActorsWithPermission(
        [foremanWithGrant, officerWithout],
        'rfq.read',
      );

      expect(result).toEqual([foremanWithGrant]);
      expect(prisma.customRolePermission.findMany).toHaveBeenCalledWith({
        where: {
          customRoleId: { in: ['cr-granted', 'cr-denied'] },
          permission: { key: 'rfq.read' },
        },
        select: { customRoleId: true },
      });
    });

    it('resolves a SUPER_ADMIN through the built-in role even with a custom role set', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([{ role: UserRole.SUPER_ADMIN }]);

      const sa = { id: 'u1', role: UserRole.SUPER_ADMIN, customRoleId: 'cr-1' };

      await expect(service.filterActorsWithPermission([sa], 'rfq.read')).resolves.toEqual([sa]);
      expect(prisma.customRolePermission.findMany).not.toHaveBeenCalled();
    });
  });

  describe('userHasPermission (FOR-253)', () => {
    it('checks the custom role grant when assigned', async () => {
      prisma.customRolePermission.count.mockResolvedValue(1);

      await expect(
        service.userHasPermission(
          { role: UserRole.FOREMAN, customRoleId: 'cr-1' },
          'materialRequest.approve',
        ),
      ).resolves.toBe(true);

      expect(prisma.customRolePermission.count).toHaveBeenCalledWith({
        where: { customRoleId: 'cr-1', permission: { key: 'materialRequest.approve' } },
      });
      expect(prisma.rolePermission.count).not.toHaveBeenCalled();
    });

    it('denies when the custom role lacks the key even if the built-in role holds it', async () => {
      prisma.customRolePermission.count.mockResolvedValue(0);
      prisma.rolePermission.count.mockResolvedValue(1);

      await expect(
        service.userHasPermission(
          { role: UserRole.COMPANY_ADMIN, customRoleId: 'cr-1' },
          'user.create',
        ),
      ).resolves.toBe(false);
    });

    it('falls back to the built-in role when no custom role is assigned', async () => {
      prisma.rolePermission.count.mockResolvedValue(1);

      await expect(
        service.userHasPermission({ role: UserRole.VENDOR, customRoleId: null }, 'rfq.submitQuote'),
      ).resolves.toBe(true);
      expect(prisma.customRolePermission.count).not.toHaveBeenCalled();
    });
  });
});
