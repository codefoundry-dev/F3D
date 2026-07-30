import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * The slice of the authenticated user that permission resolution needs.
 * `customRoleId` (FOR-253) is optional so role-only callers keep working.
 */
export interface PermissionActor {
  role: UserRole;
  customRoleId?: string | null;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the live set of permission keys granted to a user. Called from
   * PermissionsGuard on every request so a permission revocation takes effect
   * on the next call without needing cache invalidation.
   *
   * Custom-role-first (FOR-253): a user with an assigned custom role gets that
   * role's grants INSTEAD of the built-in role's. SUPER_ADMIN is exempt — the
   * platform role always resolves through its built-in grants (assignment is
   * also blocked at the API layer, this is belt and braces).
   */
  async getPermissionsForUser(actor: PermissionActor): Promise<Set<string>> {
    if (actor.customRoleId && actor.role !== UserRole.SUPER_ADMIN) {
      return this.getPermissionsForCustomRole(actor.customRoleId);
    }
    return this.getPermissionsForRole(actor.role);
  }

  async getPermissionsForRole(role: UserRole): Promise<Set<string>> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permission: { select: { key: true } } },
    });
    return new Set(rows.map((r) => r.permission.key));
  }

  async getPermissionsForCustomRole(customRoleId: string): Promise<Set<string>> {
    const rows = await this.prisma.customRolePermission.findMany({
      where: { customRoleId },
      select: { permission: { select: { key: true } } },
    });
    return new Set(rows.map((r) => r.permission.key));
  }

  /** Custom-role-first single-key check; see getPermissionsForUser. */
  async userHasPermission(actor: PermissionActor, key: string): Promise<boolean> {
    if (actor.customRoleId && actor.role !== UserRole.SUPER_ADMIN) {
      const count = await this.prisma.customRolePermission.count({
        where: { customRoleId: actor.customRoleId, permission: { key } },
      });
      return count > 0;
    }
    return this.roleHasPermission(actor.role, key);
  }

  async roleHasPermission(role: UserRole, key: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: { role, permission: { key } },
    });
    return count > 0;
  }
}
