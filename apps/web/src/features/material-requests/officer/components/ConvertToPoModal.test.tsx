import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockOnConfirm = vi.hoisted(() => vi.fn());
const mockOnClose = vi.hoisted(() => vi.fn());
const mockUseCompanyVendors = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));
vi.mock('@forethread/ui-components/assets/icons/purchase-orders.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components', () => ({
  GridModal: ({
    title,
    description,
    children,
    actions,
  }: {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    actions?: ReactNode;
  }) => (
    <div role="dialog">
      <h2>{title}</h2>
      <div>{description}</div>
      <div>{children}</div>
      <div>{actions}</div>
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    variant: _variant,
    size: _size,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  Select: ({ children, ...props }: Record<string, unknown>) => (
    <select {...props}>{children as ReactNode}</select>
  ),
  Spinner: () => <div data-testid="spinner" />,
}));
vi.mock('../../services/material-requests.service', () => ({
  useCompanyVendors: (companyId: string) => mockUseCompanyVendors(companyId),
}));

import { ConvertToPoModal } from './ConvertToPoModal';

const vendor = (id: string, tradeName: string | null, legalName: string) => ({
  id,
  type: 'VENDOR',
  legalName,
  tradeName,
  abn: null,
  taxCode: null,
  legalAddress: null,
  contactEmail: null,
  contactPhone: null,
  website: null,
  logoUrl: null,
  status: 'ACTIVE',
  specialisations: [],
  createdAt: '',
  updatedAt: '',
  assignedAt: '',
});

describe('ConvertToPoModal', () => {
  beforeEach(() => vi.clearAllMocks());

  const setup = () =>
    render(
      <ConvertToPoModal
        mrNumber="MR-1"
        companyId="comp-1"
        onClose={mockOnClose}
        onConfirm={mockOnConfirm}
      />,
    );

  it('shows a spinner while vendors load', () => {
    mockUseCompanyVendors.mockReturnValue({ isLoading: true });
    setup();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows an empty message when the company has no vendors', () => {
    mockUseCompanyVendors.mockReturnValue({ isLoading: false, data: [] });
    setup();
    expect(screen.getByText('convertPoModal.noVendors')).toBeInTheDocument();
    expect(screen.getByTestId('mr-convert-confirm')).toBeDisabled();
  });

  it('shows an error message when vendor load fails', () => {
    mockUseCompanyVendors.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    setup();
    expect(screen.getByText('convertPoModal.loadFailed')).toBeInTheDocument();
  });

  it('requires a vendor selection before confirm is enabled', () => {
    mockUseCompanyVendors.mockReturnValue({
      isLoading: false,
      data: [vendor('v1', 'Acme Trading', 'Acme Pty Ltd')],
    });
    setup();
    const confirm = screen.getByTestId('mr-convert-confirm');
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByTestId('mr-convert-vendor'), { target: { value: 'v1' } });
    expect(confirm).not.toBeDisabled();
  });

  it('confirms with the selected vendor id', () => {
    mockUseCompanyVendors.mockReturnValue({
      isLoading: false,
      data: [vendor('v1', null, 'Acme Pty Ltd'), vendor('v2', 'Beta Co', 'Beta Pty Ltd')],
    });
    setup();
    fireEvent.change(screen.getByTestId('mr-convert-vendor'), { target: { value: 'v2' } });
    fireEvent.click(screen.getByTestId('mr-convert-confirm'));
    expect(mockOnConfirm).toHaveBeenCalledWith('v2');
  });
});
