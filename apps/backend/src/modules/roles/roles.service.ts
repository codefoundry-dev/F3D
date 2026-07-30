import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { IsArray, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class CreateCustomRoleDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  /** Same dynamic-key shape (and caveats) as UpdateRolePermissionsDto.thresholds. */
  @IsOptional()
  @IsObject()
  thresholds?: Record<string, number | null>;
}

export class UpdateCustomRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];

  @IsOptional()
  @IsObject()
  thresholds?: Record<string, number | null>;
}

export interface RoleSummary {
  role: UserRole;
  permissionCount: number;
}

export interface CustomRoleSummary {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number;
  /** Users currently holding this role (FOR-253). */
  assignedUserCount: number;
  createdAt: Date;
}

export interface CustomRoleDetail {
  id: string;
  name: string;
  description: string | null;
  permissionKeys: PermissionKey[];
  /** Sparse — only granted threshold-aware permissions with a finite cap. */
  thresholds: Record<string, number>;
  /** Users currently holding this role (FOR-253) — non-zero blocks deletion. */
  assignedUserCount: number;
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

/** Blank or whitespace-only descriptions are stored as null, not ''. */
function normalizeDescription(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  return trimmed;
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

  // ── Custom roles (FOR-252) ────────────────────────────────────────────────
  // Scoped to the actor's company: a Company Admin manages the roles of their
  // own company, a Super Admin (companyId null) manages platform-level roles.

  async listCustomRoles(companyId: string | null): Promise<CustomRoleSummary[]> {
    const rows = await this.prisma.customRole.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: { select: { permissions: true, users: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissionCount: r._count.permissions,
      assignedUserCount: r._count.users,
      createdAt: r.createdAt,
    }));
  }

  async createCustomRole(
    companyId: string | null,
    dto: CreateCustomRoleDto,
    actorId: string,
    ipAddress?: string,
  ): Promise<CustomRoleDetail> {
    const name = this.parseCustomRoleName(dto.name);
    await this.assertCustomRoleNameAvailable(name, companyId);

    const requested = this.parsePermissionKeys(dto.permissionKeys ?? []);
    const sanitizedThresholds = this.parseThresholds(dto.thresholds, new Set<string>(requested));
    const grants = await this.buildGrantRows(requested, sanitizedThresholds);

    const created = await this.prisma.customRole.create({
      data: {
        companyId,
        name,
        description: normalizeDescription(dto.description),
        permissions: { create: grants },
      },
      select: { id: true },
    });

    await this.audit.log({
      action: AuditAction.CUSTOM_ROLE_CREATED,
      performedById: actorId,
      targetType: 'CustomRole',
      targetId: created.id,
      targetLabel: name,
      metadata: { name, companyId, permissionKeys: requested },
      ipAddress,
    });

    return this.getCustomRoleDetail(created.id, companyId);
  }

  async getCustomRoleDetail(id: string, companyId: string | null): Promise<CustomRoleDetail> {
    const role = await this.prisma.customRole.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: {
          select: {
            thresholdAmount: true,
            permission: { select: { key: true } },
          },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException(ERR.roles.customRoleNotFound);

    const permissionKeys = role.permissions
      .map((r) => r.permission.key)
      .filter((k): k is PermissionKey => KNOWN_PERMISSION_KEYS.has(k))
      .sort();

    const thresholds: Record<string, number> = {};
    for (const row of role.permissions) {
      const numeric = toNumber(row.thresholdAmount);
      if (numeric !== null && isThresholdAware(row.permission.key)) {
        thresholds[row.permission.key] = numeric;
      }
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissionKeys,
      thresholds,
      assignedUserCount: role._count.users,
    };
  }

  async updateCustomRole(
    id: string,
    companyId: string | null,
    dto: UpdateCustomRoleDto,
    actorId: string,
    ipAddress?: string,
  ): Promise<CustomRoleDetail> {
    const existing = await this.prisma.customRole.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!existing) throw new NotFoundException(ERR.roles.customRoleNotFound);

    const name = dto.name !== undefined ? this.parseCustomRoleName(dto.name) : existing.name;
    if (name.toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertCustomRoleNameAvailable(name, companyId);
    }

    // Replace-semantics on the grant set: the role wholly owns its rows, so a
    // wipe-and-recreate inside the transaction is simpler than the surgical
    // diff the built-in roles need (their seeded rows must survive deploys).
    const requested =
      dto.permissionKeys !== undefined
        ? this.parsePermissionKeys(dto.permissionKeys)
        : existing.permissions
            .map((p) => p.permission.key)
            .filter((k): k is PermissionKey => KNOWN_PERMISSION_KEYS.has(k));
    const sanitizedThresholds = this.parseThresholds(dto.thresholds, new Set<string>(requested));
    const grants = await this.buildGrantRows(requested, sanitizedThresholds);

    await this.prisma.$transaction([
      this.prisma.customRole.update({
        where: { id },
        data: {
          name,
          ...(dto.description !== undefined
            ? { description: normalizeDescription(dto.description) }
            : {}),
        },
      }),
      this.prisma.customRolePermission.deleteMany({ where: { customRoleId: id } }),
      this.prisma.customRolePermission.createMany({
        data: grants.map((g) => ({ ...g, customRoleId: id })),
      }),
    ]);

    const previousKeys = new Set(existing.permissions.map((p) => p.permission.key));
    const added = requested.filter((k) => !previousKeys.has(k));
    const removed = [...previousKeys].filter((k) => !(requested as string[]).includes(k));
    await this.audit.log({
      action: AuditAction.CUSTOM_ROLE_UPDATED,
      performedById: actorId,
      targetType: 'CustomRole',
      targetId: id,
      targetLabel: name,
      metadata: {
        name,
        previousName: existing.name,
        added,
        removed,
        thresholds: sanitizedThresholds,
      },
      ipAddress,
    });

    return this.getCustomRoleDetail(id, companyId);
  }

  async deleteCustomRole(
    id: string,
    companyId: string | null,
    actorId: string,
    ipAddress?: string,
  ): Promise<{ message: string }> {
    const existing = await this.prisma.customRole.findFirst({
      where: { id, companyId },
      select: { id: true, name: true, _count: { select: { users: true } } },
    });
    if (!existing) throw new NotFoundException(ERR.roles.customRoleNotFound);

    // FOR-253: a role that users still hold cannot be deleted — unassign first.
    if (existing._count.users > 0) {
      throw new BadRequestException(
        ERR.roles.customRoleInUse(existing.name, existing._count.users),
      );
    }

    await this.prisma.customRole.delete({ where: { id } });

    await this.audit.log({
      action: AuditAction.CUSTOM_ROLE_DELETED,
      performedById: actorId,
      targetType: 'CustomRole',
      targetId: id,
      targetLabel: existing.name,
      metadata: { name: existing.name, companyId },
      ipAddress,
    });

    return { message: 'Custom role deleted' };
  }

  private parseCustomRoleName(raw: string): string {
    const name = raw.trim();
    if (!name) throw new BadRequestException(ERR.roles.emptyCustomRoleName);
    return name;
  }

  private async assertCustomRoleNameAvailable(
    name: string,
    companyId: string | null,
  ): Promise<void> {
    // Case-insensitive service-side check — the DB unique index treats NULL
    // company_id values as distinct rows, so it cannot cover the platform scope.
    const clash = await this.prisma.customRole.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) throw new BadRequestException(ERR.roles.duplicateCustomRoleName(name));
  }

  private async buildGrantRows(
    keys: PermissionKey[],
    thresholds: Record<string, number | null>,
  ): Promise<Array<{ permissionId: string; thresholdAmount: number | null }>> {
    if (keys.length === 0) return [];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });
    const idByKey = new Map(permissions.map((p) => [p.key, p.id]));
    const rows: Array<{ permissionId: string; thresholdAmount: number | null }> = [];
    for (const key of keys) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      rows.push({
        permissionId,
        thresholdAmount: isThresholdAware(key) ? (thresholds[key] ?? null) : null,
      });
    }
    return rows;
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
