import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the live set of permission keys granted to a role. Called from
   * PermissionsGuard on every request so a permission revocation takes effect
   * on the next call without needing cache invalidation.
   */
  async getPermissionsForRole(role: UserRole): Promise<Set<string>> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permission: { select: { key: true } } },
    });
    return new Set(rows.map((r) => r.permission.key));
  }

  async roleHasPermission(role: UserRole, key: string): Promise<boolean> {
    const count = await this.prisma.rolePermission.count({
      where: { role, permission: { key } },
    });
    return count > 0;
  }
}
