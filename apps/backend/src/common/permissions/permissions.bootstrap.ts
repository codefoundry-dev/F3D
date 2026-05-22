import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ALL_PERMISSION_KEYS, PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from './permissions.catalog';

/**
 * Idempotent startup hook that:
 *   1. Upserts every entry from the permission catalog into the `permissions` table.
 *   2. Ensures each built-in role has the canonical default permissions granted.
 *
 * The bootstrap NEVER revokes a role's permissions — Company Admin overrides
 * (FOR-195) live in the same table and would be erased on next deploy if we
 * deleted unknown rows. It only adds missing defaults.
 */
@Injectable()
export class PermissionsBootstrap implements OnModuleInit {
  private readonly logger = new Logger(PermissionsBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncCatalog();
    await this.syncRoleDefaults();
  }

  private async syncCatalog(): Promise<void> {
    for (const key of ALL_PERMISSION_KEYS) {
      const description = PERMISSIONS[key];
      await this.prisma.permission.upsert({
        where: { key },
        update: { description },
        create: { key, description },
      });
    }
    this.logger.log(`Synced ${ALL_PERMISSION_KEYS.length} permissions from catalog`);
  }

  private async syncRoleDefaults(): Promise<void> {
    const allPermissions = await this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
    const idByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

    for (const role of Object.keys(ROLE_DEFAULT_PERMISSIONS) as UserRole[]) {
      const keys = ROLE_DEFAULT_PERMISSIONS[role];
      for (const key of keys) {
        const permissionId = idByKey.get(key);
        if (!permissionId) continue;
        await this.prisma.rolePermission.upsert({
          where: { role_permissionId: { role, permissionId } },
          update: {},
          create: { role, permissionId },
        });
      }
    }
    this.logger.log('Synced role default permissions');
  }
}
