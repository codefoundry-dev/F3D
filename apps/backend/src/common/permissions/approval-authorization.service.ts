import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { isThresholdAware } from './permissions.catalog';

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
   * Resolve whether a role may approve a document whose total is `amount`,
   * using the threshold attached to its `permissionKey` grant.
   *
   * `null` threshold = unlimited (allowed regardless of amount).
   * Non-threshold-aware permission keys always resolve as `allowed` with a
   * null threshold — callers should check that separately if they want to
   * reject non-approval keys here.
   */
  async evaluate(
    role: UserRole,
    permissionKey: string,
    amount: Prisma.Decimal | number | null | undefined,
  ): Promise<ThresholdDecision> {
    const row = await this.prisma.rolePermission.findFirst({
      where: { role, permission: { key: permissionKey } },
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
}
