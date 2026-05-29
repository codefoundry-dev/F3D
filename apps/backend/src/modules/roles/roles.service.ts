import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

import { ERR } from '../../common/constants/error-messages.const';
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  PermissionKey,
  isThresholdAware,
} from '../../common/permissions/permissions.catalog';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService, AuditAction } from '../audit/audit.service';

export class UpdateRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];

  /**
   * Optional map of threshold-aware permission key → monetary cap.
   * A null value or missing entry means "unlimited" (no cap).
   *
   * This is a dynamic-key map, so it deliberately does NOT use
   * `@ValidateNested` against a fixed-shape DTO: under the global
   * `forbidNonWhitelisted` pipe that would reject every permission key as a
   * non-whitelisted property ("thresholds.property po.approve should not
   * exist"). `@IsObject` keeps the pipe from recursing; the shape, bounds,
   * and grant rules are validated server-side in `parseThresholds`.
   */
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, number | null>;
}

export interface RoleSummary {
  role: UserRole;
  permissionCount: number;
}

export interface RoleDetail {
  role: UserRole;
  permissionKeys: PermissionKey[];
  /**
   * Threshold values for granted threshold-aware permissions. Sparse —
   * only includes keys that have a finite cap. A granted threshold-aware
   * permission without an entry here is "unlimited".
   */
  thresholds: Record<string, number>;
}

export interface CatalogEntry {
  key: PermissionKey;
  description: string;
  thresholdAware: boolean;
}

const KNOWN_PERMISSION_KEYS = new Set<string>(ALL_PERMISSION_KEYS);

function isUserRole(value: string): value is UserRole {
  return Object.values(UserRole).includes(value as UserRole);
}

function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value);
}

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCatalog(): CatalogEntry[] {
    return ALL_PERMISSION_KEYS.map((key) => ({
      key,
      description: PERMISSIONS[key],
      thresholdAware: isThresholdAware(key),
    }));
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
      select: {
        thresholdAmount: true,
        permission: { select: { key: true } },
      },
    });

    const permissionKeys = rows
      .map((r) => r.permission.key)
      .filter((k): k is PermissionKey => KNOWN_PERMISSION_KEYS.has(k))
      .sort();

    const thresholds: Record<string, number> = {};
    for (const row of rows) {
      const numeric = toNumber(row.thresholdAmount);
      if (numeric !== null && isThresholdAware(row.permission.key)) {
        thresholds[row.permission.key] = numeric;
      }
    }

    return { role, permissionKeys, thresholds };
  }

  async updateRolePermissions(
    roleParam: string,
    keys: string[],
    actorId: string,
    ipAddress?: string,
    thresholds?: Record<string, number | null>,
  ): Promise<RoleDetail> {
    const role = this.parseRole(roleParam);
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(ERR.roles.cannotModifySuperAdmin);
    }

    const requested = this.parsePermissionKeys(keys);
    const requestedSet = new Set<string>(requested);
    const sanitizedThresholds = this.parseThresholds(thresholds, requestedSet);

    const allPermissions = await this.prisma.permission.findMany({
      select: { id: true, key: true },
    });
    const idByKey = new Map(allPermissions.map((p) => [p.key, p.id]));

    const current = await this.prisma.rolePermission.findMany({
      where: { role },
      select: {
        permissionId: true,
        thresholdAmount: true,
        permission: { select: { key: true } },
      },
    });
    const currentByKey = new Map(current.map((c) => [c.permission.key, c]));

    const toAddKeys = requested.filter((k) => !currentByKey.has(k));
    const toRemoveIds = current.filter((c) => !requestedSet.has(c.permission.key));

    const thresholdUpdates: Array<{ permissionId: string; key: string; value: number | null }> = [];
    for (const key of requested) {
      if (!isThresholdAware(key)) continue;
      const desiredValue = sanitizedThresholds[key] ?? null;
      const existing = currentByKey.get(key);
      const currentValue = existing ? toNumber(existing.thresholdAmount) : null;
      if (desiredValue !== currentValue) {
        const permissionId = existing?.permissionId ?? idByKey.get(key);
        if (permissionId) {
          thresholdUpdates.push({ permissionId, key, value: desiredValue });
        }
      }
    }

    const createOps = [] as ReturnType<typeof this.prisma.rolePermission.create>[];
    for (const key of toAddKeys) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      const thresholdAmount =
        isThresholdAware(key) && sanitizedThresholds[key] !== undefined
          ? sanitizedThresholds[key]
          : null;
      createOps.push(
        this.prisma.rolePermission.create({
          data: { role, permissionId, thresholdAmount },
        }),
      );
    }

    await this.prisma.$transaction([
      ...createOps,
      ...thresholdUpdates
        .filter(({ key }) => !(toAddKeys as string[]).includes(key))
        .map(({ permissionId, value }) =>
          this.prisma.rolePermission.update({
            where: { role_permissionId: { role, permissionId } },
            data: { thresholdAmount: value },
          }),
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
    const thresholdChanges = thresholdUpdates.map(({ key, value }) => ({ key, threshold: value }));
    if (toAddKeys.length > 0 || removedKeys.length > 0 || thresholdChanges.length > 0) {
      const metadata: Prisma.InputJsonValue = {
        role,
        added: toAddKeys,
        removed: removedKeys,
        thresholds: thresholdChanges,
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

  private parseThresholds(
    raw: Record<string, number | null> | undefined,
    grantedKeys: Set<string>,
  ): Record<string, number | null> {
    if (!raw) return {};
    const result: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!isThresholdAware(key)) {
        throw new BadRequestException(ERR.roles.thresholdNotSupported(key));
      }
      if (!grantedKeys.has(key)) {
        throw new BadRequestException(ERR.roles.thresholdRequiresGrant(key));
      }
      if (value === null) {
        result[key] = null;
        continue;
      }
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new BadRequestException(ERR.roles.invalidThreshold(key));
      }
      result[key] = value;
    }
    return result;
  }
}
