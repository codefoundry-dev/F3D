import { render, screen } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockCompanyId = vi.hoisted(() => ({ value: 'company-1' as string | undefined }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (
    selector: (s: { currentUser: { companyId: string | undefined } | null }) => unknown,
  ) => selector({ currentUser: mockCompanyId.value ? { companyId: mockCompanyId.value } : null }),
}));

vi.mock('@forethread/vendor-shared', () => ({
  VendorProfilePage: ({ vendorId, onBack }: { vendorId: string; onBack: () => void }) => (
    <div data-testid="vendor-profile-page">
      <span>{vendorId}</span>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

import CompanyProfilePage from './CompanyProfilePage';

describe('CompanyProfilePage (vendor)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompanyId.value = 'company-1';
  });

  it('renders VendorProfilePage when companyId exists', () => {
    render(<CompanyProfilePage />);
    expect(screen.getByTestId('vendor-profile-page')).toBeInTheDocument();
    expect(screen.getByText('company-1')).toBeInTheDocument();
  });

  it('renders nothing when companyId is undefined', () => {
    mockCompanyId.value = undefined;
    const { container } = render(<CompanyProfilePage />);
    expect(container.innerHTML).toBe('');
  });

  it('navigates back when onBack is triggered', () => {
    render(<CompanyProfilePage />);
    screen.getByText('Back').click();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
