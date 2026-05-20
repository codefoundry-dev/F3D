import { ComponentStatus } from '../../types/super-admin/platform-state.types';

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
};

export const STATUS_COLORS: Record<string, string> = {
  [ComponentStatus.HEALTHY]:
    'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  [ComponentStatus.ERROR]:
    'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))] border-[hsl(var(--destructive))]/20',
  [ComponentStatus.WARNING]:
    'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
  [ComponentStatus.DISABLED]: 'bg-muted/50 text-muted-foreground border-muted',
};
