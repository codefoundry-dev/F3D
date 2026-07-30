import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { isThresholdAware } from './permissions.catalog';
import { PermissionActor } from './permissions.service';

/**
 * Result of evaluating whether a role's permission grant covers a monetary
 * amount (FOR-196). `notGranted` means the role never held the permission;
 * `belowThreshold` means it does but the amount exceeds the configured cap;
 * `allowed` means either no cap is set (unlimited) or the amount is at or
 * below the cap.
 */
export type ThresholdDecision =
  | { outcome: 'allowed'; threshold: Prisma.Decimal | null }
  | { outcome: 'belowThreshold'; threshold: Prisma.Decimal }
  | { outcome: 'notGranted' };

@Injectable()
export class ApprovalAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve whether an actor may approve a document whose total is `amount`,
   * using the threshold attached to their `permissionKey` grant. Custom-role-
   * first (FOR-253): an assigned custom role's grant (and cap) replaces the
   * built-in role's; SUPER_ADMIN always resolves through the built-in role.
   *
   * `null` threshold = unlimited (allowed regardless of amount).
   * Non-threshold-aware permission keys always resolve as `allowed` with a
   * null threshold — callers should check that separately if they want to
   * reject non-approval keys here.
   */
  async evaluate(
    actor: PermissionActor,
    permissionKey: string,
    amount: Prisma.Decimal | number | null | undefined,
  ): Promise<ThresholdDecision> {
    const useCustomRole = Boolean(actor.customRoleId) && actor.role !== UserRole.SUPER_ADMIN;
    const row = useCustomRole
      ? await this.prisma.customRolePermission.findFirst({
          where: { customRoleId: actor.customRoleId as string, permission: { key: permissionKey } },
          select: { thresholdAmount: true },
        })
      : await this.prisma.rolePermission.findFirst({
          where: { role: actor.role, permission: { key: permissionKey } },
          select: { thresholdAmount: true },
        });

    if (!row) {
      return { outcome: 'notGranted' };
    }

    const threshold = row.thresholdAmount;

    if (!isThresholdAware(permissionKey) || threshold === null || threshold === undefined) {
      return { outcome: 'allowed', threshold: null };
    }

    if (amount === null || amount === undefined) {
      // A threshold is configured but no amount was supplied — treat as allowed
      // for now (callers that care should pass an amount). This preserves
      // current behaviour for any non-finance approval flow that reuses the
      // same permission key.
      return { outcome: 'allowed', threshold };
    }

    const amountDecimal = amount instanceof Prisma.Decimal ? amount : new Prisma.Decimal(amount);
    if (amountDecimal.greaterThan(threshold)) {
      return { outcome: 'belowThreshold', threshold };
    }

    return { outcome: 'allowed', threshold };
  }

  /**
   * Emails of the ACTIVE users in `companyId` whose effective `permissionKey`
   * grant covers `amount` — the recipients an over-limit document should be
   * routed to (FOR-286). "Effective" follows the same custom-role-first rule
   * as `evaluate`: a user with an assigned custom role is judged solely by
   * that role's grant (their built-in role's grant is replaced), everyone
   * else by their built-in role's. Batch-resolved in three queries so callers
   * can fan out notifications without a per-user `evaluate` loop.
   */
  async findEligibleApproverEmails(
    companyId: string,
    permissionKey: string,
    amount: Prisma.Decimal | number | null | undefined,
  ): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: { companyId, status: UserStatus.ACTIVE },
      select: { email: true, role: true, customRoleId: true },
    });
    if (users.length === 0) return [];

    const roleGrants = await this.prisma.rolePermission.findMany({
      where: { permission: { key: permissionKey } },
      select: { role: true, thresholdAmount: true },
    });
    const roleThresholds = new Map<string, Prisma.Decimal | null>(
      roleGrants.map((g) => [g.role, g.thresholdAmount]),
    );

    const customRoleIds = [
      ...new Set(users.map((u) => u.customRoleId).filter((id): id is string => Boolean(id))),
    ];
    const customGrants =
      customRoleIds.length > 0
        ? await this.prisma.customRolePermission.findMany({
            where: { customRoleId: { in: customRoleIds }, permission: { key: permissionKey } },
            select: { customRoleId: true, thresholdAmount: true },
          })
        : [];
    const customThresholds = new Map<string, Prisma.Decimal | null>(
      customGrants.map((g) => [g.customRoleId, g.thresholdAmount]),
    );

    const amountDecimal =
      amount === null || amount === undefined
        ? null
        : amount instanceof Prisma.Decimal
          ? amount
          : new Prisma.Decimal(amount);
    // A null amount is within every cap (matches `evaluate`'s missing-amount rule).
    const covers = (threshold: Prisma.Decimal | null): boolean =>
      !isThresholdAware(permissionKey) ||
      threshold === null ||
      !amountDecimal?.greaterThan(threshold);

    const emails = users
      .filter((u) => {
        const useCustomRole = Boolean(u.customRoleId) && u.role !== UserRole.SUPER_ADMIN;
        const grants = useCustomRole ? customThresholds : roleThresholds;
        const grantKey = useCustomRole ? (u.customRoleId as string) : u.role;
        return grants.has(grantKey) && covers(grants.get(grantKey) ?? null);
      })
      .map((u) => u.email);

    return [...new Set(emails)];
  }
}
