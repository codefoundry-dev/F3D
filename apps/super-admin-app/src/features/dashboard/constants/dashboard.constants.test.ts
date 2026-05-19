import { ComponentStatus } from '../types/platform-state.types';

import { AUDIT_ACTION_LABELS, STATUS_COLORS } from './dashboard.constants';

describe('dashboard.constants', () => {
  describe('AUDIT_ACTION_LABELS', () => {
    it('maps known audit actions to human-readable labels', () => {
      expect(AUDIT_ACTION_LABELS.USER_CREATED).toBe('User created');
      expect(AUDIT_ACTION_LABELS.COMPANY_CREATED).toBe('Company created');
      expect(AUDIT_ACTION_LABELS.USER_DEACTIVATED).toBe('User deactivated');
      expect(AUDIT_ACTION_LABELS.USER_REACTIVATED).toBe('User reactivated');
      expect(AUDIT_ACTION_LABELS.USER_INVITATION_RESENT).toBe('Invitation resent');
      expect(AUDIT_ACTION_LABELS.USER_INVITATION_CANCELLED).toBe('Invitation cancelled');
      expect(AUDIT_ACTION_LABELS.USER_PASSWORD_RESET_INITIATED).toBe('Password reset initiated');
      expect(AUDIT_ACTION_LABELS.COMPANY_UPDATED).toBe('Company updated');
      expect(AUDIT_ACTION_LABELS.USER_UPDATED).toBe('User updated');
    });

    it('returns undefined for unknown actions', () => {
      expect(AUDIT_ACTION_LABELS['UNKNOWN_ACTION']).toBeUndefined();
    });
  });

  describe('STATUS_COLORS', () => {
    it('has a class string for each ComponentStatus value', () => {
      expect(STATUS_COLORS[ComponentStatus.HEALTHY]).toBeDefined();
      expect(STATUS_COLORS[ComponentStatus.ERROR]).toBeDefined();
      expect(STATUS_COLORS[ComponentStatus.WARNING]).toBeDefined();
      expect(STATUS_COLORS[ComponentStatus.DISABLED]).toBeDefined();
    });

    it('healthy status includes success color classes', () => {
      expect(STATUS_COLORS[ComponentStatus.HEALTHY]).toContain('success');
    });

    it('error status includes destructive color classes', () => {
      expect(STATUS_COLORS[ComponentStatus.ERROR]).toContain('destructive');
    });

    it('warning status includes warning color classes', () => {
      expect(STATUS_COLORS[ComponentStatus.WARNING]).toContain('warning');
    });

    it('disabled status includes muted color classes', () => {
      expect(STATUS_COLORS[ComponentStatus.DISABLED]).toContain('muted');
    });
  });
});
