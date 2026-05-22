export {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  ROLE_DEFAULT_PERMISSIONS,
  THRESHOLD_AWARE_PERMISSIONS,
  isThresholdAware,
} from './permissions.catalog';
export type { PermissionKey, ThresholdAwarePermissionKey } from './permissions.catalog';
export { RequirePermissions, PERMISSIONS_KEY } from './permissions.decorator';
export { PermissionsGuard } from './permissions.guard';
export { PermissionsService } from './permissions.service';
export { PermissionsBootstrap } from './permissions.bootstrap';
export { PermissionsModule } from './permissions.module';
export { ApprovalAuthorizationService } from './approval-authorization.service';
export type { ThresholdDecision } from './approval-authorization.service';
