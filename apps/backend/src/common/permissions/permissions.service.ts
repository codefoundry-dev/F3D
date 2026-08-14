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

  /**
   * Filter a batch of actors down to those whose effective permission set
   * includes `key`, with the same custom-role-first resolution as
   * getPermissionsForUser but in two queries for the whole batch instead of
   * one per actor. Used by notification fan-outs (FOR-351) so users who
   * cannot open an entity are not told about it.
   */
  async filterActorsWithPermission<T extends PermissionActor>(
    actors: T[],
    key: string,
  ): Promise<T[]> {
    if (actors.length === 0) return [];

    const usesCustomRole = <A extends PermissionActor>(a: A): a is A & { customRoleId: string } =>
      !!a.customRoleId && a.role !== UserRole.SUPER_ADMIN;

    const customRoleIds = [...new Set(actors.filter(usesCustomRole).map((a) => a.customRoleId))];

    const [roleRows, customRows] = await Promise.all([
      this.prisma.rolePermission.findMany({
        where: { permission: { key } },
        select: { role: true },
      }),
      customRoleIds.length > 0
        ? this.prisma.customRolePermission.findMany({
            where: { customRoleId: { in: customRoleIds }, permission: { key } },
            select: { customRoleId: true },
          })
        : [],
    ]);

    const grantedRoles = new Set(roleRows.map((r) => r.role));
    const grantedCustomRoles = new Set(customRows.map((r) => r.customRoleId));

    return actors.filter((a) =>
      usesCustomRole(a) ? grantedCustomRoles.has(a.customRoleId) : grantedRoles.has(a.role),
    );
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
