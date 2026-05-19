import { UserRole } from '@forethread/shared-types/client';

import {
  ALL_ROLE_OPTIONS,
  CONTRACTOR_ROLE_OPTIONS,
  ROLE_BADGE_COLORS,
  STATUS_BADGE_COLORS,
  STATUS_TEXT_COLORS,
} from './roles';

describe('roles constants', () => {
  describe('ALL_ROLE_OPTIONS', () => {
    it('includes all 7 UserRole values', () => {
      expect(ALL_ROLE_OPTIONS).toHaveLength(7);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.SUPER_ADMIN);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.COMPANY_ADMIN);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.PROCUREMENT_OFFICER);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.FINANCIAL_OFFICER);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.FOREMAN);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.WAREHOUSE_OFFICER);
      expect(ALL_ROLE_OPTIONS).toContain(UserRole.VENDOR);
    });
  });

  describe('CONTRACTOR_ROLE_OPTIONS', () => {
    it('does not include SuperAdmin', () => {
      expect(CONTRACTOR_ROLE_OPTIONS).not.toContain(UserRole.SUPER_ADMIN);
    });

    it('does not include Vendor', () => {
      expect(CONTRACTOR_ROLE_OPTIONS).not.toContain(UserRole.VENDOR);
    });

    it('includes the 5 contractor roles', () => {
      expect(CONTRACTOR_ROLE_OPTIONS).toHaveLength(5);
      expect(CONTRACTOR_ROLE_OPTIONS).toContain(UserRole.COMPANY_ADMIN);
      expect(CONTRACTOR_ROLE_OPTIONS).toContain(UserRole.PROCUREMENT_OFFICER);
      expect(CONTRACTOR_ROLE_OPTIONS).toContain(UserRole.FINANCIAL_OFFICER);
      expect(CONTRACTOR_ROLE_OPTIONS).toContain(UserRole.WAREHOUSE_OFFICER);
      expect(CONTRACTOR_ROLE_OPTIONS).toContain(UserRole.FOREMAN);
    });
  });

  describe('ROLE_BADGE_COLORS', () => {
    it('has a color entry for every role in ALL_ROLE_OPTIONS', () => {
      for (const role of ALL_ROLE_OPTIONS) {
        expect(ROLE_BADGE_COLORS[role]).toBeDefined();
      }
    });

    it('all color values are non-empty strings', () => {
      for (const role of ALL_ROLE_OPTIONS) {
        expect(typeof ROLE_BADGE_COLORS[role]).toBe('string');
        expect(ROLE_BADGE_COLORS[role].length).toBeGreaterThan(0);
      }
    });
  });

  describe('STATUS_BADGE_COLORS', () => {
    const statuses = ['ACTIVE', 'INACTIVE', 'INVITED'];

    it('has a color entry for every status', () => {
      for (const status of statuses) {
        expect(STATUS_BADGE_COLORS[status]).toBeDefined();
      }
    });

    it('all color values are non-empty strings', () => {
      for (const status of statuses) {
        expect(typeof STATUS_BADGE_COLORS[status]).toBe('string');
        expect(STATUS_BADGE_COLORS[status].length).toBeGreaterThan(0);
      }
    });
  });

  describe('STATUS_TEXT_COLORS', () => {
    const statuses = ['ACTIVE', 'INACTIVE', 'INVITED'];

    it('has a color entry for every status', () => {
      for (const status of statuses) {
        expect(STATUS_TEXT_COLORS[status]).toBeDefined();
      }
    });

    it('all color values are non-empty strings', () => {
      for (const status of statuses) {
        expect(typeof STATUS_TEXT_COLORS[status]).toBe('string');
        expect(STATUS_TEXT_COLORS[status].length).toBeGreaterThan(0);
      }
    });
  });
});
