import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { IsArray, IsString } from 'class-validator';

import { ERR } from '../../common/constants/error-messages.const';
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  PermissionKey,
} from '../../common/permissions/permissions.catalog';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}

export interface RoleSummary {
  role: UserRole;
  permissionCount: number;
}

export interface RoleDetail {
  role: UserRole;
  permissionKeys: PermissionKey[];
}

export interface CatalogEntry {
  key: PermissionKey;
  description: string;
}

const KNOWN_PERMISSION_KEYS = new Set<string>(ALL_PERMISSION_KEYS);

function isUserRole(value: string): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCatalog(): CatalogEntry[] {
    return ALL_PERMISSION_KEYS.map((key) => ({ key, description: PERMISSIONS[key] }));
  }

  async listRoles(): Promise<RoleSummary[]> {
    const counts = await this.prisma.rolePermission.groupBy({
      by: ['role'],
      _count: { _all: true },
    });
    const byRole = new Map<UserRole, number>(counts.map((c) => [c.role, c._count._all]));
    return (Object.values(UserRole) as UserRole[]).map((role) => ({
      role,
      permissionCount: byRole.get(role) ?? 0,
    }));
  }

  async getRoleDetail(roleParam: string): Promise<RoleDetail> {
    const role = this.parseRole(roleParam);
    const rows = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permission: { select: { key: true } } },
    });
    return {
      role,
      permissionKeys: rows
        .map((r) => r.permission.key)
        .filter((k): k is PermissionKey => KNOWN_PERMISSION_KEYS.has(k))
        .sort(),
    };
  }

  async updateRolePermissions(
    roleParam: string,
    keys: string[],
    actorId: string,
    ipAddress?: string,
  ): Promise<RoleDetail> {
    const role = this.parseRole(roleParam);
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(ERR.roles.cannotModifySuperAdmin);
    }

    const requested = this.parsePermissionKeys(keys);

    const allPermissions = await this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
    const idByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

    const current = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permissionId: true, permission: { select: { key: true } } },
    });
    const currentKeys = new Set(current.map((c) => c.permission.key));

    const targetKeys = new Set<string>(requested);
    const toAddKeys = requested.filter((k) => !currentKeys.has(k));
    const toRemoveIds = current.filter((c) => !targetKeys.has(c.permission.key));

    await this.prisma.$transaction([
      ...toAddKeys
        .map((key) => idByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) =>
          this.prisma.rolePermission.create({ data: { role, permissionId } }),
        ),
      ...(toRemoveIds.length > 0
        ? [
            this.prisma.rolePermission.deleteMany({
              where: {
                role,
                permissionId: { in: toRemoveIds.map((r) => r.permissionId) },
              },
            }),
          ]
        : []),
    ]);

    const removedKeys = toRemoveIds.map((r) => r.permission.key);
    if (toAddKeys.length > 0 || removedKeys.length > 0) {
      const metadata: Prisma.InputJsonValue = {
        role,
        added: toAddKeys,
        removed: removedKeys,
      };
      await this.audit.log({
        action: AuditAction.ROLE_PERMISSIONS_UPDATED,
        performedById: actorId,
        targetType: 'Role',
        targetId: role,
        targetLabel: role,
        metadata,
        ipAddress,
      });
    }

    return this.getRoleDetail(role);
  }

  private parseRole(value: string): UserRole {
    if (!isUserRole(value)) {
      throw new NotFoundException(ERR.roles.unknownRole(value));
    }
    return value;
  }

  private parsePermissionKeys(keys: string[]): PermissionKey[] {
    const unknown = keys.find((k) => !KNOWN_PERMISSION_KEYS.has(k));
    if (unknown !== undefined) {
      throw new BadRequestException(ERR.roles.unknownPermission(unknown));
    }
    return Array.from(new Set(keys)) as PermissionKey[];
  }
}
