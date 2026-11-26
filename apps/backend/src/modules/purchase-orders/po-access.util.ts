import { UserRole } from '@prisma/client';

import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Who may read a single PO (and its history and change requests): super admins,
 * any user of the buying company, and vendor users of the PO's vendor. Vendors
 * match on vendorId, never companyId, mirroring listPurchaseOrders. A user with
 * no company never matches, so a vendorless draft is not readable by "null ===
 * null".
 */
export function canReadPurchaseOrder(
  po: { companyId: string; vendorId: string | null },
  user: Pick<AuthenticatedUser, 'role' | 'companyId'>,
): boolean {
  if (user.role === UserRole.SUPER_ADMIN) return true;
  if (!user.companyId) return false;
  if (user.role === UserRole.VENDOR) return po.vendorId === user.companyId;
  return po.companyId === user.companyId;
}
