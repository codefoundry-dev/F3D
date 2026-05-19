vi.mock('@forethread/shared-types/client', () => ({
  UserRole: {
    COMPANY_ADMIN: 'COMPANY_ADMIN',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCIAL_OFFICER: 'FINANCIAL_OFFICER',
    FOREMAN: 'FOREMAN',
    WAREHOUSE_OFFICER: 'WAREHOUSE_OFFICER',
    SUPER_ADMIN: 'SUPER_ADMIN',
  },
}));

import {
  COMPANY_ROLE_OPTIONS,
  ROLE_BADGE_COLORS,
  STATUS_BADGE_COLORS,
  STATUS_TEXT_COLORS,
} from './roles';

describe('roles constants', () => {
  it('COMPANY_ROLE_OPTIONS has 5 roles', () => {
    expect(COMPANY_ROLE_OPTIONS).toHaveLength(5);
  });

  it('does not include SuperAdmin', () => {
    expect(COMPANY_ROLE_OPTIONS).not.toContain('SUPER_ADMIN');
  });

  it('ROLE_BADGE_COLORS has entries for each company role', () => {
    for (const role of COMPANY_ROLE_OPTIONS) {
      expect(ROLE_BADGE_COLORS[role]).toBeDefined();
    }
  });

  it('STATUS_BADGE_COLORS has Active, Inactive, Invited', () => {
    expect(STATUS_BADGE_COLORS['ACTIVE']).toBeDefined();
    expect(STATUS_BADGE_COLORS['INACTIVE']).toBeDefined();
    expect(STATUS_BADGE_COLORS['INVITED']).toBeDefined();
  });

  it('STATUS_TEXT_COLORS has Active, Inactive, Invited', () => {
    expect(STATUS_TEXT_COLORS['ACTIVE']).toBeDefined();
    expect(STATUS_TEXT_COLORS['INACTIVE']).toBeDefined();
    expect(STATUS_TEXT_COLORS['INVITED']).toBeDefined();
  });
});
