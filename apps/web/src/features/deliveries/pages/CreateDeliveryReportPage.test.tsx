import type { PoDetail } from '@forethread/api-client';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockUsePurchaseOrder = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));
vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: (id: string) => mockUsePurchaseOrder(id),
}));
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (sel: (s: { setTitle: () => void }) => unknown) => sel({ setTitle: () => {} }),
  // Mirrors the real thumb: nothing without a URL.
  MaterialImageThumb: ({ url, name }: { url?: string | null; name: string }) =>
    url ? <img data-testid="material-image-thumb" src={url} alt={name} /> : null,
}));
const phone = vi.hoisted(() => ({ value: false }));
vi.mock('@forethread/ui-components', () => ({
  ScrollTable: ({ children }: { children: JSX.Element }) => children,
  useIsPhone: () => phone.value,
  MobileActionBar: ({ children }: { children: ReactNode }) => (
    <div data-testid="mobile-action-bar">{children}</div>
  ),
  // Minimal card/sheet stand-in: renders every visible field's input per line.
  LineItemEditor: ({
    lines,
    fields,
    getTitle,
  }: {
    lines: unknown[];
    fields: {
      key: string;
      input: (l: unknown, i: number) => ReactNode;
      hidden?: (l: unknown, i: number) => boolean;
    }[];
    getTitle: (l: unknown, i: number) => ReactNode;
  }) => (
    <div data-testid="line-item-cards">
      {lines.map((l, i) => (
        <div key={i} data-testid="line-item-card">
          {getTitle(l, i)}
          {fields
            .filter((f) => !f.hidden?.(l, i))
            .map((f) => (
              <div key={f.key}>{f.input(l, i)}</div>
            ))}
        </div>
      ))}
    </div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
    rightIcon: _r,
    leftIcon: _l,
    isLoading: _il,
    variant: _v,
    size: _s,
    ...props
  }: Record<string, unknown>) => (
    <button onClick={onClick as () => void} disabled={disabled as boolean} {...props}>
      {children as ReactNode}
    </button>
  ),
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: ({ children, ...props }: Record<string, unknown>) => (
    <select {...props}>{children as ReactNode}</select>
  ),
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  FileDropzone: ({ buttonLabel }: { buttonLabel: string }) => <div>{buttonLabel}</div>,
  FileChip: ({ name }: { name: string }) => <span>{name}</span>,
  Spinner: () => <div data-testid="spinner" />,
  cn: (...c: unknown[]) => c.filter(Boolean).join(' '),
  notificationService: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@forethread/ui-components/assets/icons/checkcircle-icon.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <svg />,
}));
vi.mock('@/app/route-config', () => ({
  ROUTES: { deliveries: '/deliveries', deliveryDetail: '/deliveries/:id' },
}));
vi.mock('../components/DamageDetailsForm', () => ({
  DamageDetailsForm: () => <div data-testid="damage-form" />,
  EMPTY_DAMAGE_DRAFT: { damagedQuantity: '0', damageType: '', damageDisposition: null, photos: [] },
}));
vi.mock('../components/SelectPoModal', () => ({
  SelectPoModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="select-po-modal" /> : null,
}));
vi.mock('../services/deliveries.service', () => ({
  useCreateDeliveryReport: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUploadDeliveryAttachment: () => ({ mutateAsync: vi.fn() }),
  useUploadDeliveryLinePhoto: () => ({ mutateAsync: vi.fn() }),
}));

import CreateDeliveryReportPage from './CreateDeliveryReportPage';

function po(overrides: Partial<PoDetail> = {}): PoDetail {
  return {
    id: 'po-1',
    poNumber: 'PO-2025-001',
    projectId: 'p1',
    projectName: 'Downtown',
    deliveryLocationId: 'loc-1',
    vendor: { id: 'v1', name: 'BuildSupply' },
    lineItems: [
      {
        id: 'li-1',
        lineNumber: 1,
        materialId: 'm1',
        materialName: 'Aluminum Beam 6061',
        materialCode: '1234567890',
        description: '12ft, Structural',
        quantityOrdered: 30,
        quantityDelivered: 0,
        unitOfMeasure: 'pcs',
        unitPrice: 10,
        lineTotal: 300,
        costCode: null,
        expectedDeliveryDate: null,
        deliveryLocation: null,
        notes: null,
        pickUp: false,
      },
    ],
    // The rest of PoDetail is not read by the page under test.
    ...overrides,
  } as PoDetail;
}

describe('CreateDeliveryReportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    phone.value = false;
    mockSearchParams.get.mockReturnValue('po-1');
  });

  it('shows the PO picker prompt when there is no poId', () => {
    mockSearchParams.get.mockReturnValue(null);
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    render(<CreateDeliveryReportPage />);
    expect(screen.getByText('create.noPo')).toBeInTheDocument();
  });

  it('shows a spinner while the PO loads', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<CreateDeliveryReportPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('seeds the line-item table from the PO', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
    render(<CreateDeliveryReportPage />);
    const table = screen.getByTestId('delivery-create-table');
    expect(table).toBeInTheDocument();
    expect(screen.getByText('Aluminum Beam 6061')).toBeInTheDocument();
    expect(screen.getByTestId('delivery-row-li-1')).toBeInTheDocument();
  });

  it('reveals the damage sub-form when outcome is set to DAMAGED', () => {
    mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
    render(<CreateDeliveryReportPage />);
    expect(screen.queryByTestId('damage-form')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('create.columns.outcome Aluminum Beam 6061'), {
      target: { value: 'DAMAGED' },
    });
    expect(screen.getByTestId('damage-form')).toBeInTheDocument();
  });

  it('submits the report and navigates to the detail page', async () => {
    mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
    mockCreate.mockResolvedValue({ id: 'd-99', lines: [{ id: 'rl-1', poLineItemId: 'li-1' }] });
    render(<CreateDeliveryReportPage />);

    fireEvent.click(screen.getByTestId('delivery-submit'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        purchaseOrderId: 'po-1',
        lines: [expect.objectContaining({ poLineItemId: 'li-1', quantityReceived: 30 })],
      }),
    );
    // FOR-402: the line's catalogue image is display-only and never submitted.
    expect(JSON.stringify(mockCreate.mock.calls[0][0])).not.toContain('imageUrl');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/deliveries/d-99'));
  });

  describe('catalogue images (FOR-402)', () => {
    const withImage = () => {
      const base = po();
      return po({
        lineItems: [{ ...base.lineItems[0], imageUrl: 'https://cdn.example/beam.png' }],
      });
    };

    it('shows the material image next to the name in the table', () => {
      mockUsePurchaseOrder.mockReturnValue({ data: withImage(), isLoading: false, isError: false });
      render(<CreateDeliveryReportPage />);
      const row = screen.getByTestId('delivery-row-li-1');
      expect(within(row).getByRole('img', { name: 'Aluminum Beam 6061' })).toHaveAttribute(
        'src',
        'https://cdn.example/beam.png',
      );
    });

    it('shows it on the phone line card too', () => {
      phone.value = true;
      mockUsePurchaseOrder.mockReturnValue({ data: withImage(), isLoading: false, isError: false });
      render(<CreateDeliveryReportPage />);
      expect(
        within(screen.getByTestId('line-item-card')).getByRole('img', {
          name: 'Aluminum Beam 6061',
        }),
      ).toBeInTheDocument();
    });

    it('renders no image for a line without one', () => {
      mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
      render(<CreateDeliveryReportPage />);
      expect(screen.getByText('Aluminum Beam 6061')).toBeInTheDocument();
      expect(screen.queryByTestId('material-image-thumb')).not.toBeInTheDocument();
    });
  });

  describe('on phones (ADR-0019 B10, FOR-380)', () => {
    beforeEach(() => {
      phone.value = true;
    });

    it('swaps the table for line cards that reuse the grid fields', () => {
      mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
      render(<CreateDeliveryReportPage />);
      expect(screen.queryByTestId('delivery-create-table')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('line-item-card')).toHaveLength(1);
      // Same bound inputs as the desktop cells.
      expect(screen.getByLabelText('create.columns.qtyReceived Aluminum Beam 6061')).toHaveValue(
        30,
      );
      expect(screen.queryByTestId('damage-form')).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText('create.columns.outcome Aluminum Beam 6061'), {
        target: { value: 'DAMAGED' },
      });
      expect(screen.getByTestId('damage-form')).toBeInTheDocument();
    });

    it('puts Cancel / Submit in the fixed action bar', () => {
      mockUsePurchaseOrder.mockReturnValue({ data: po(), isLoading: false, isError: false });
      render(<CreateDeliveryReportPage />);
      expect(screen.getByTestId('mobile-action-bar')).toContainElement(
        screen.getByTestId('delivery-submit'),
      );
    });
  });
});
