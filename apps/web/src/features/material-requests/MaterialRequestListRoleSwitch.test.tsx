import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseUserRole = vi.hoisted(() => vi.fn());

// RoleSwitch reads the current role via useUserRole and redirects unknown roles
// to /forbidden. We stub useUserRole and the two lazy pages so the switch's
// role→page wiring is what's under test.
vi.mock('@/shared/role', () => ({
  RoleSwitch: ({
    byRole,
    fallback = '/forbidden',
  }: {
    byRole: Record<string, React.ReactNode>;
    fallback?: string;
  }) => {
    const role = mockUseUserRole() as string | null;
    if (!role || byRole[role] === undefined) return <div>redirect:{fallback}</div>;
    return <>{byRole[role]}</>;
  },
}));
vi.mock('./pages/MyRequestsPage', () => ({ default: () => <div>mobile-flow</div> }));
vi.mock('./officer/pages/OfficerDashboardPage', () => ({
  default: () => <div>officer-dashboard</div>,
}));

import MaterialRequestListRoleSwitch from './MaterialRequestListRoleSwitch';

describe('MaterialRequestListRoleSwitch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the mobile flow for a FOREMAN', async () => {
    mockUseUserRole.mockReturnValue('FOREMAN');
    render(<MaterialRequestListRoleSwitch />);
    expect(await screen.findByText('mobile-flow')).toBeInTheDocument();
  });

  it('renders the mobile flow for a WAREHOUSE_OFFICER', async () => {
    mockUseUserRole.mockReturnValue('WAREHOUSE_OFFICER');
    render(<MaterialRequestListRoleSwitch />);
    expect(await screen.findByText('mobile-flow')).toBeInTheDocument();
  });

  it('renders the officer dashboard for a PROCUREMENT_OFFICER', async () => {
    mockUseUserRole.mockReturnValue('PROCUREMENT_OFFICER');
    render(<MaterialRequestListRoleSwitch />);
    expect(await screen.findByText('officer-dashboard')).toBeInTheDocument();
  });

  it('renders the officer dashboard for a COMPANY_ADMIN', async () => {
    mockUseUserRole.mockReturnValue('COMPANY_ADMIN');
    render(<MaterialRequestListRoleSwitch />);
    expect(await screen.findByText('officer-dashboard')).toBeInTheDocument();
  });

  it('renders the officer dashboard for a SUPER_ADMIN', async () => {
    mockUseUserRole.mockReturnValue('SUPER_ADMIN');
    render(<MaterialRequestListRoleSwitch />);
    expect(await screen.findByText('officer-dashboard')).toBeInTheDocument();
  });

  it('redirects an unmapped role to /forbidden', () => {
    mockUseUserRole.mockReturnValue('VENDOR');
    render(<MaterialRequestListRoleSwitch />);
    expect(screen.getByText('redirect:/forbidden')).toBeInTheDocument();
  });
});
