/** Default i18n keys for permission items shown in the profile page */
export const DEFAULT_PERMISSION_KEYS = [
  'permissionRfq',
  'permissionPo',
  'permissionInventory',
] as const;

/** Audit action labels displayed in the activity log timeline */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USER_DEACTIVATED: 'User deactivated',
  USER_REACTIVATED: 'User reactivated',
  USER_INVITATION_RESENT: 'Invitation resent',
  USER_INVITATION_CANCELLED: 'Invitation cancelled',
  USER_PASSWORD_RESET_INITIATED: 'Password reset initiated',
  COMPANY_CREATED: 'Company created',
  COMPANY_UPDATED: 'Company updated',
  FILE_UPLOADED: 'File uploaded',
  FILE_DELETED: 'File deleted',
  PROJECT_CREATED: 'Project created',
  PROJECT_UPDATED: 'Project updated',
  PROJECT_MEMBER_ADDED: 'Project member added',
  PROJECT_MEMBER_REMOVED: 'Project member removed',
  VENDOR_ASSIGNED: 'Vendor assigned',
  VENDOR_UNASSIGNED: 'Vendor unassigned',
};
