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

/**
 * One member of a document's Approver Pool (ADR-0006 amendment 2026-08-07) —
 * an ACTIVE user in the document's own company whose effective approval grant
 * covers the document total.
 *
 * Deliberately carries no threshold amount. The Pool is rendered to tenants,
 * and publishing per-user caps would expose the company's spend hierarchy and
 * invite approver-shopping. `role` plus `customRoleName` is all the UI needs to
 * label the Pool; built-in role labels are resolved from i18n on the client.
 */
export interface ApproverPoolMember {
  id: string;
  name: string;
  email: string;
  /** Built-in role. Stays authoritative for scope even when a custom role is assigned. */
  role: UserRole;
  /** Set when the user holds a custom role, whose grant replaced the built-in one (FOR-253). */
  customRoleName: string | null;
}

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
   * The Approver Pool for a document: the ACTIVE users in `companyId` whose
   * effective `permissionKey` grant covers `amount` (ADR-0006 amendment).
   * "Effective" follows the same custom-role-first rule as `evaluate` — a user
   * with an assigned custom role is judged solely by that role's grant (their
   * built-in role's grant is replaced), everyone else by their built-in role's.
   * Batch-resolved in three queries so callers can fan out notifications
   * without a per-user `evaluate` loop.
   *
   * The Pool is **authority**, purely role-and-threshold derived, and is
   * recomputed on every read rather than snapshotted: authorisation is
   * evaluated live at approve time, so a frozen Pool would name approvers who
   * then hit a 403. Membership always means "this cap covers this amount" with
   * no exceptions — when the Pool is empty, callers notify Company Admins as a
   * fallback *recipient* (see `findCompanyAdminRecipients`) rather than adding
   * them here.
   *
   * SUPER_ADMIN has a null `companyId`, so it never appears in a Pool even
   * though it bypasses the threshold on approve as break-glass. That is
   * deliberate — platform-operator identity is not exposed to tenants.
   */
  async resolveApproverPool(
    companyId: string,
    permissionKey: string,
    amount: Prisma.Decimal | number | null | undefined,
  ): Promise<ApproverPoolMember[]> {
    const users = await this.prisma.user.findMany({
      where: { companyId, status: UserStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        customRole: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
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

    return users
      .filter((u) => {
        const useCustomRole = Boolean(u.customRoleId) && u.role !== UserRole.SUPER_ADMIN;
        const grants = useCustomRole ? customThresholds : roleThresholds;
        const grantKey = useCustomRole ? (u.customRoleId as string) : u.role;
        return grants.has(grantKey) && covers(grants.get(grantKey) ?? null);
      })
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        customRoleName:
          u.customRoleId && u.role !== UserRole.SUPER_ADMIN ? (u.customRole?.name ?? null) : null,
      }));
  }

  /**
   * Emails of the document's Approver Pool — the fan-out list for an over-limit
   * document (FOR-286). Thin projection of {@link resolveApproverPool} so
   * eligibility lives in exactly one place.
   */
  async findEligibleApproverEmails(
    companyId: string,
    permissionKey: string,
    amount: Prisma.Decimal | number | null | undefined,
  ): Promise<string[]> {
    const pool = await this.resolveApproverPool(companyId, permissionKey, amount);
    return [...new Set(pool.map((m) => m.email))];
  }

  /**
   * ACTIVE Company Admins in `companyId` — the fallback *recipients* when a
   * document's Approver Pool is empty (FOR-302).
   *
   * Selected by built-in role alone, deliberately ignoring approval caps: these
   * users are being told that nobody can approve the document, not being handed
   * authority to approve it themselves. They resolve the state by raising a
   * limit or reducing the document, never by approving past their own cap.
   */
  async findCompanyAdminRecipients(companyId: string): Promise<ApproverPoolMember[]> {
    const admins = await this.prisma.user.findMany({
      where: { companyId, status: UserStatus.ACTIVE, role: UserRole.COMPANY_ADMIN },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        customRoleId: true,
        customRole: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return admins.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      customRoleName: u.customRoleId ? (u.customRole?.name ?? null) : null,
    }));
  }
}
