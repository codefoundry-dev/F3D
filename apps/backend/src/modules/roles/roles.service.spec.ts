import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ALL_PERMISSION_KEYS } from '../../common/permissions/permissions.catalog';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';

import { RolesService } from './roles.service';

interface MockPrisma {
  permission: { findMany: jest.Mock };
  rolePermission: {
    findMany: jest.Mock;
    groupBy: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    deleteMany: jest.Mock;
  };
  $transaction: jest.Mock;
}

describe('RolesService', () => {
  let prisma: MockPrisma;
  let audit: { log: jest.Mock };
  let service: RolesService;

  beforeEach(() => {
    prisma = {
      permission: { findMany: jest.fn() },
      rolePermission: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn().mockReturnValue({ __op: 'create' }),
        update: jest.fn().mockReturnValue({ __op: 'update' }),
        deleteMany: jest.fn().mockReturnValue({ __op: 'deleteMany' }),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    service = new RolesService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
    );
  });

  describe('listCatalog', () => {
    it('returns every catalog entry with its description', () => {
      const result = service.listCatalog();
      expect(result).toHaveLength(ALL_PERMISSION_KEYS.length);
      expect(result.every((entry) => entry.key && entry.description)).toBe(true);
    });
  });

  describe('listRoles', () => {
    it('returns every UserRole with its permission count, zero-filling roles with no rows', async () => {
      prisma.rolePermission.groupBy.mockResolvedValue([
        { role: UserRole.COMPANY_ADMIN, _count: { _all: 42 } },
        { role: UserRole.VENDOR, _count: { _all: 30 } },
      ]);

      const result = await service.listRoles();
      const byRole = new Map(result.map((r) => [r.role, r.permissionCount]));

      expect(byRole.get(UserRole.COMPANY_ADMIN)).toBe(42);
      expect(byRole.get(UserRole.VENDOR)).toBe(30);
      expect(byRole.get(UserRole.FOREMAN)).toBe(0);
      expect(result.length).toBe(Object.values(UserRole).length);
    });
  });

  describe('getRoleDetail', () => {
    it('returns the sorted catalog-known permission keys for a role', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { thresholdAmount: null, permission: { key: 'rfq.read' } },
        { thresholdAmount: null, permission: { key: 'rfq.create' } },
        { thresholdAmount: null, permission: { key: 'legacy.unknown' } },
      ]);

      const result = await service.getRoleDetail(UserRole.PROCUREMENT_OFFICER);

      expect(result.role).toBe(UserRole.PROCUREMENT_OFFICER);
      expect(result.permissionKeys).toEqual(['rfq.create', 'rfq.read']);
      expect(result.thresholds).toEqual({});
    });

    it('returns the thresholds for granted threshold-aware permissions', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { thresholdAmount: { toString: () => '25000' }, permission: { key: 'po.approve' } },
        { thresholdAmount: null, permission: { key: 'invoice.approve' } },
        { thresholdAmount: null, permission: { key: 'po.read' } },
      ]);

      const result = await service.getRoleDetail(UserRole.PROCUREMENT_OFFICER);

      expect(result.permissionKeys).toEqual(
        expect.arrayContaining(['po.approve', 'invoice.approve', 'po.read']),
      );
      expect(result.thresholds).toEqual({ 'po.approve': 25000 });
    });

    it('omits thresholds for non-threshold-aware permissions even if the column is populated', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { thresholdAmount: { toString: () => '1000' }, permission: { key: 'po.read' } },
      ]);

      const result = await service.getRoleDetail(UserRole.PROCUREMENT_OFFICER);
      expect(result.thresholds).toEqual({});
    });

    it('rejects an unknown role with 404', async () => {
      await expect(service.getRoleDetail('GHOST_ROLE')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRolePermissions', () => {
    function arrangeCurrent(
      currentKeys: string[],
      currentThresholds: Record<string, number> = {},
    ) {
      prisma.permission.findMany.mockResolvedValue([
        { id: 'p-rfq.read', key: 'rfq.read' },
        { id: 'p-rfq.create', key: 'rfq.create' },
        { id: 'p-po.approve', key: 'po.approve' },
        { id: 'p-invoice.approve', key: 'invoice.approve' },
      ]);
      prisma.rolePermission.findMany.mockImplementation((args: { where?: unknown }) => {
        if (args.where) {
          return Promise.resolve(
            currentKeys.map((k) => ({
              permissionId: `p-${k}`,
              thresholdAmount:
                currentThresholds[k] !== undefined
                  ? { toString: () => String(currentThresholds[k]) }
                  : null,
              permission: { key: k },
            })),
          );
        }
        return Promise.resolve([]);
      });
    }

    it('rejects an unknown permission key with 400', async () => {
      await expect(
        service.updateRolePermissions(UserRole.VENDOR, ['rfq.read', 'rfq.notReal'], 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects modifying SUPER_ADMIN', async () => {
      await expect(
        service.updateRolePermissions(UserRole.SUPER_ADMIN, ['rfq.read'], 'actor-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('adds new permissions and removes ones not in the requested set', async () => {
      arrangeCurrent(['rfq.read', 'po.approve']);
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([
          {
            permissionId: 'p-rfq.read',
            thresholdAmount: null,
            permission: { key: 'rfq.read' },
          },
          {
            permissionId: 'p-po.approve',
            thresholdAmount: null,
            permission: { key: 'po.approve' },
          },
        ])
        .mockResolvedValueOnce([
          { thresholdAmount: null, permission: { key: 'rfq.read' } },
          { thresholdAmount: null, permission: { key: 'rfq.create' } },
        ]);

      const result = await service.updateRolePermissions(
        UserRole.PROCUREMENT_OFFICER,
        ['rfq.read', 'rfq.create'],
        'actor-1',
        '10.0.0.1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const txOps = prisma.$transaction.mock.calls[0][0] as unknown[];
      // 1 create + 1 deleteMany
      expect(txOps).toHaveLength(2);
      expect(prisma.rolePermission.create).toHaveBeenCalledWith({
        data: {
          role: UserRole.PROCUREMENT_OFFICER,
          permissionId: 'p-rfq.create',
          thresholdAmount: null,
        },
      });
      expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { role: UserRole.PROCUREMENT_OFFICER, permissionId: { in: ['p-po.approve'] } },
      });

      expect(audit.log).toHaveBeenCalledWith({
        action: AuditAction.ROLE_PERMISSIONS_UPDATED,
        performedById: 'actor-1',
        targetType: 'Role',
        targetId: UserRole.PROCUREMENT_OFFICER,
        targetLabel: UserRole.PROCUREMENT_OFFICER,
        metadata: {
          role: UserRole.PROCUREMENT_OFFICER,
          added: ['rfq.create'],
          removed: ['po.approve'],
          thresholds: [],
        },
        ipAddress: '10.0.0.1',
      });

      expect(result.permissionKeys).toEqual(['rfq.create', 'rfq.read']);
    });

    it('does not write an audit log when nothing changed', async () => {
      arrangeCurrent(['rfq.read']);
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([
          {
            permissionId: 'p-rfq.read',
            thresholdAmount: null,
            permission: { key: 'rfq.read' },
          },
        ])
        .mockResolvedValueOnce([{ thresholdAmount: null, permission: { key: 'rfq.read' } }]);

      await service.updateRolePermissions(UserRole.VENDOR, ['rfq.read'], 'actor-1');

      expect(audit.log).not.toHaveBeenCalled();
      const txOps = prisma.$transaction.mock.calls[0][0] as unknown[];
      expect(txOps).toHaveLength(0);
    });

    it('deduplicates the requested permission list', async () => {
      arrangeCurrent([]);
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ thresholdAmount: null, permission: { key: 'rfq.read' } }]);

      await service.updateRolePermissions(
        UserRole.FOREMAN,
        ['rfq.read', 'rfq.read'],
        'actor-1',
      );

      expect(prisma.rolePermission.create).toHaveBeenCalledTimes(1);
    });

    it('creates a new grant with the supplied threshold for a threshold-aware permission', async () => {
      arrangeCurrent([]);
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            thresholdAmount: { toString: () => '25000' },
            permission: { key: 'po.approve' },
          },
        ]);

      await service.updateRolePermissions(
        UserRole.PROCUREMENT_OFFICER,
        ['po.approve'],
        'actor-1',
        undefined,
        { 'po.approve': 25000 },
      );

      expect(prisma.rolePermission.create).toHaveBeenCalledWith({
        data: {
          role: UserRole.PROCUREMENT_OFFICER,
          permissionId: 'p-po.approve',
          thresholdAmount: 25000,
        },
      });
    });

    it('updates the threshold on an existing grant when it changes', async () => {
      arrangeCurrent(['po.approve'], { 'po.approve': 10000 });
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([
          {
            permissionId: 'p-po.approve',
            thresholdAmount: { toString: () => '10000' },
            permission: { key: 'po.approve' },
          },
        ])
        .mockResolvedValueOnce([
          {
            thresholdAmount: { toString: () => '50000' },
            permission: { key: 'po.approve' },
          },
        ]);

      await service.updateRolePermissions(
        UserRole.PROCUREMENT_OFFICER,
        ['po.approve'],
        'actor-1',
        undefined,
        { 'po.approve': 50000 },
      );

      expect(prisma.rolePermission.update).toHaveBeenCalledWith({
        where: {
          role_permissionId: {
            role: UserRole.PROCUREMENT_OFFICER,
            permissionId: 'p-po.approve',
          },
        },
        data: { thresholdAmount: 50000 },
      });

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            thresholds: [{ key: 'po.approve', threshold: 50000 }],
          }),
        }),
      );
    });

    it('clears a threshold to null (unlimited) when explicitly set to null', async () => {
      arrangeCurrent(['po.approve'], { 'po.approve': 10000 });
      prisma.rolePermission.findMany
        .mockResolvedValueOnce([
          {
            permissionId: 'p-po.approve',
            thresholdAmount: { toString: () => '10000' },
            permission: { key: 'po.approve' },
          },
        ])
        .mockResolvedValueOnce([
          { thresholdAmount: null, permission: { key: 'po.approve' } },
        ]);

      await service.updateRolePermissions(
        UserRole.COMPANY_ADMIN,
        ['po.approve'],
        'actor-1',
        undefined,
        { 'po.approve': null },
      );

      expect(prisma.rolePermission.update).toHaveBeenCalledWith({
        where: {
          role_permissionId: {
            role: UserRole.COMPANY_ADMIN,
            permissionId: 'p-po.approve',
          },
        },
        data: { thresholdAmount: null },
      });
    });

    it('rejects a threshold for a permission that is not granted', async () => {
      arrangeCurrent([]);

      await expect(
        service.updateRolePermissions(
          UserRole.PROCUREMENT_OFFICER,
          ['rfq.read'],
          'actor-1',
          undefined,
          { 'po.approve': 25000 },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a threshold on a permission that is not threshold-aware', async () => {
      arrangeCurrent([]);

      await expect(
        service.updateRolePermissions(
          UserRole.PROCUREMENT_OFFICER,
          ['rfq.read'],
          'actor-1',
          undefined,
          { 'rfq.read': 100 } as Record<string, number>,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a negative threshold value', async () => {
      arrangeCurrent([]);

      await expect(
        service.updateRolePermissions(
          UserRole.PROCUREMENT_OFFICER,
          ['po.approve'],
          'actor-1',
          undefined,
          { 'po.approve': -1 },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
