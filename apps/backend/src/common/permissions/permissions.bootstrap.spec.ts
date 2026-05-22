import { PrismaService } from '../../prisma/prisma.service';

import { PermissionsBootstrap } from './permissions.bootstrap';
import { ALL_PERMISSION_KEYS, ROLE_DEFAULT_PERMISSIONS } from './permissions.catalog';

describe('PermissionsBootstrap', () => {
  let bootstrap: PermissionsBootstrap;
  let prisma: {
    permission: { upsert: jest.Mock; findMany: jest.Mock };
    rolePermission: { upsert: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      permission: {
        upsert: jest
          .fn()
          .mockImplementation(({ where, create }) =>
            Promise.resolve({ id: `id-${where.key}`, key: where.key, ...create }),
          ),
        findMany: jest.fn(),
      },
      rolePermission: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    bootstrap = new PermissionsBootstrap(prisma as unknown as PrismaService);
  });

  it('upserts every permission key from the catalog', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    await bootstrap.onModuleInit();

    expect(prisma.permission.upsert).toHaveBeenCalledTimes(ALL_PERMISSION_KEYS.length);
    for (const key of ALL_PERMISSION_KEYS) {
      expect(prisma.permission.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key } }),
      );
    }
  });

  it('grants each role its default permissions', async () => {
    const fakePermissions = ALL_PERMISSION_KEYS.map((key) => ({ id: `id-${key}`, key }));
    prisma.permission.findMany.mockResolvedValue(fakePermissions);

    await bootstrap.onModuleInit();

    const expectedRolePermissionRows = Object.entries(ROLE_DEFAULT_PERMISSIONS).reduce(
      (total, [, keys]) => total + keys.length,
      0,
    );
    expect(prisma.rolePermission.upsert).toHaveBeenCalledTimes(expectedRolePermissionRows);
  });

  it('does NOT delete existing role permissions (preserves Company Admin overrides)', async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    await bootstrap.onModuleInit();

    expect(prisma.rolePermission).not.toHaveProperty('deleteMany');
  });
});
