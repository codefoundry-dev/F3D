import { render, screen } from '@testing-library/react';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => new URLSearchParams());
const mockParams = vi.hoisted(() => ({ id: 'vendor-1' as string | undefined }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useSearchParams: () => [mockSearchParams],
}));

vi.mock('@forethread/vendor-shared', () => ({
  VendorProfilePage: ({ vendorId, onBack, initialEdit }: any) => (
    <div
      data-testid="shared-vendor-profile"
      data-vendor-id={vendorId}
      data-initial-edit={String(initialEdit)}
    >
      <button data-testid="back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  ),
}));

import VendorProfilePage from './VendorProfilePage';

describe('VendorProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.id = 'vendor-1';
    mockSearchParams.delete('edit');
  });

  it('renders SharedVendorProfilePage with vendorId from params', () => {
    render(<VendorProfilePage />);
    expect(screen.getByTestId('shared-vendor-profile')).toHaveAttribute(
      'data-vendor-id',
      'vendor-1',
    );
  });

  it('passes initialEdit=true when edit search param is true', () => {
    mockSearchParams.set('edit', 'true');
    render(<VendorProfilePage />);
    expect(screen.getByTestId('shared-vendor-profile')).toHaveAttribute(
      'data-initial-edit',
      'true',
    );
  });

  it('passes initialEdit=false when edit search param is absent', () => {
    render(<VendorProfilePage />);
    expect(screen.getByTestId('shared-vendor-profile')).toHaveAttribute(
      'data-initial-edit',
      'false',
    );
  });

  it('calls navigate(-1) when onBack is triggered', () => {
    render(<VendorProfilePage />);
    screen.getByTestId('back-btn').click();
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('returns null when id param is missing', () => {
    mockParams.id = undefined;
    const { container } = render(<VendorProfilePage />);
    expect(container.innerHTML).toBe('');
  });
});
