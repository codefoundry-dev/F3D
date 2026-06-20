import type { DeliveryReportDetailResponse } from '@forethread/shared-types/client';
import {
  DamageDisposition,
  DamageType,
  DeliveryOutcome,
  DeliveryReportSource,
  DeliveryReportStatus,
} from '@forethread/shared-types/client';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUseDeliveryReport = vi.hoisted(() => vi.fn());
const mockApprove = vi.hoisted(() => vi.fn());
const mockReject = vi.hoisted(() => vi.fn());
const mockHas = vi.hoisted(() => vi.fn(() => true));

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'd-1' }) }));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: (s: { setTitle: () => void }) => unknown) => sel({ setTitle: () => {} }),
}));
vi.mock('@forethread/ui-components', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    leftIcon: _l,
    isLoading: _il,
    variant: _v,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  Spinner: () => <div data-testid="spinner" />,
  cn: (...c: unknown[]) => c.filter(Boolean).join(' '),
  formatDate: (d: string | null) => d ?? '-',
  notificationService: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({ ROUTES: { deliveries: '/deliveries' } }));
vi.mock('@/shared/role/usePermissions', () => ({ usePermissions: () => ({ has: mockHas }) }));
vi.mock('../components/RejectDeliveryModal', () => ({
  RejectDeliveryModal: ({ onConfirm }: { onConfirm: (r: string) => void }) => (
    <div data-testid="reject-modal">
      <button onClick={() => onConfirm('nope')}>do-reject</button>
    </div>
  ),
}));
vi.mock('../services/deliveries.service', () => ({
  useDeliveryReport: (id: string | undefined) => mockUseDeliveryReport(id),
  useApproveDeliveryReport: () => ({ mutate: mockApprove, isPending: false }),
  useRejectDeliveryReport: () => ({ mutate: mockReject, isPending: false }),
}));

import DeliveryReportDetailPage from './DeliveryReportDetailPage';

function detail(
  overrides: Partial<DeliveryReportDetailResponse> = {},
): DeliveryReportDetailResponse {
  return {
    id: 'd-1',
    reportNumber: 'DR-0001',
    status: DeliveryReportStatus.SUBMITTED,
    source: DeliveryReportSource.INTERNAL,
    purchaseOrderId: 'po-1',
    poNumber: 'PO-2025-001',
    projectId: 'p1',
    projectName: 'Downtown Office',
    deliveryDate: 'Jan 20, 2025',
    deliveryLocationId: 'l1',
    deliveryLocationName: '321 Birch Road',
    vendorId: 'v1',
    vendorName: 'BuildSupply Co',
    submitterName: 'Marcus Webb',
    submitterEmail: 'marcus@x.com',
    contactPerson: 'Name Surname',
    contactPhone: '+1234567890',
    overallNotes: null,
    rejectionReason: null,
    reviewedByName: null,
    reviewedAt: null,
    createdAt: 'Jan 20, 2025',
    updatedAt: 'Jan 20, 2025',
    attachments: [],
    lines: [
      {
        id: 'rl-1',
        poLineItemId: 'li-1',
        lineItemRef: '1234567890',
        materialId: 'm1',
        materialName: 'Aluminum Beam 6061',
        description: '12ft, Structural',
        uom: 'pcs',
        quantityOrdered: 30,
        quantityReceived: 30,
        outcome: DeliveryOutcome.DELIVERED,
        notes: 'Lorem ipsum delivery note.',
        damagedQuantity: null,
        damageType: null,
        damageDisposition: null,
        damagePhotos: [],
      },
    ],
    ...overrides,
  };
}

describe('DeliveryReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHas.mockReturnValue(true);
  });

  it('shows the spinner while loading', () => {
    mockUseDeliveryReport.mockReturnValue({ isLoading: true });
    render(<DeliveryReportDetailPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renders the information grid and a line item', () => {
    mockUseDeliveryReport.mockReturnValue({ isLoading: false, isError: false, data: detail() });
    render(<DeliveryReportDetailPage />);
    expect(screen.getByText('PO-2025-001')).toBeInTheDocument();
    expect(screen.getByText('Marcus Webb')).toBeInTheDocument();
    const table = screen.getByTestId('delivery-detail-table');
    expect(within(table).getByText('Aluminum Beam 6061')).toBeInTheDocument();
  });

  it('renders the expandable notes row', () => {
    mockUseDeliveryReport.mockReturnValue({ isLoading: false, isError: false, data: detail() });
    render(<DeliveryReportDetailPage />);
    expect(screen.getByText('Lorem ipsum delivery note.')).toBeInTheDocument();
  });

  it('renders damage details for a DAMAGED line', () => {
    mockUseDeliveryReport.mockReturnValue({
      isLoading: false,
      isError: false,
      data: detail({
        lines: [
          {
            id: 'rl-2',
            poLineItemId: 'li-2',
            lineItemRef: '999',
            materialId: null,
            materialName: 'PVC Pipe',
            description: '2 inch',
            uom: 'units',
            quantityOrdered: 80,
            quantityReceived: 80,
            outcome: DeliveryOutcome.DAMAGED,
            notes: null,
            damagedQuantity: 12,
            damageType: DamageType.IN_TRANSIT,
            damageDisposition: DamageDisposition.ACCEPTED,
            damagePhotos: [{ id: 'ph-1', fileId: 'f1', fileName: 'x.jpg', url: 'http://x/x.jpg' }],
          },
        ],
      }),
    });
    render(<DeliveryReportDetailPage />);
    expect(screen.getByText('damage.title')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-damage-photos-rl-2')).toBeInTheDocument();
  });

  it('shows approve/reject for a SUBMITTED report and approves', () => {
    mockUseDeliveryReport.mockReturnValue({ isLoading: false, isError: false, data: detail() });
    render(<DeliveryReportDetailPage />);
    fireEvent.click(screen.getByTestId('delivery-detail-approve'));
    expect(mockApprove).toHaveBeenCalledWith('d-1', expect.anything());
  });

  it('opens the reject modal and rejects with a reason', () => {
    mockUseDeliveryReport.mockReturnValue({ isLoading: false, isError: false, data: detail() });
    render(<DeliveryReportDetailPage />);
    fireEvent.click(screen.getByTestId('delivery-detail-reject'));
    fireEvent.click(screen.getByText('do-reject'));
    expect(mockReject).toHaveBeenCalledWith({ id: 'd-1', reason: 'nope' }, expect.anything());
  });

  it('hides approve/reject once the report is no longer SUBMITTED', () => {
    mockUseDeliveryReport.mockReturnValue({
      isLoading: false,
      isError: false,
      data: detail({ status: DeliveryReportStatus.APPROVED }),
    });
    render(<DeliveryReportDetailPage />);
    expect(screen.queryByTestId('delivery-detail-approve')).not.toBeInTheDocument();
  });
});
