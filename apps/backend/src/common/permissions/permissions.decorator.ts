import { SetMetadata } from '@nestjs/common';

import { PermissionKey } from './permissions.catalog';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Restrict an endpoint to users whose role grants every listed permission.
 *
 * Example:
 *   @RequirePermissions('rfq.create')
 *   @RequirePermissions('po.approve', 'po.update')
 */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
