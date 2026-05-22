import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: { rolePermission: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(() => {
    prisma = {
      rolePermission: { findMany: jest.fn(), count: jest.fn() },
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
});
