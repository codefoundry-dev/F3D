import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@forethread/ui-components', () => ({
  Checkbox: ({
    checked,
    onChange,
    disabled,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      type="checkbox"
      data-testid="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
  ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  DatePicker: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (v: string) => void;
    borderless?: boolean;
    disabled?: boolean;
  }) => (
    <input
      data-testid="date-picker"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
  Input: ({
    value,
    onChange,
    disabled,
    rightIcon,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    rightIcon?: React.ReactNode;
    className?: string;
    disabled?: boolean;
  }) => (
    <div>
      <input data-testid="input" value={value} onChange={onChange} disabled={disabled} />
      {rightIcon}
    </div>
  ),
  MessageBadgeIcon: ({
    icon,
    onClick,
  }: {
    icon: React.ReactNode;
    onClick: () => void;
    hasNotification?: boolean;
  }) => (
    <button data-testid="message-badge" onClick={onClick}>
      {icon}
    </button>
  ),
  onDecimalOnly: vi.fn(),
  StepperInput: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <input
      data-testid="stepper-input"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    />
  ),
  ToggleSwitch: ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <input type="checkbox" data-testid="toggle-switch" checked={checked} onChange={onChange} />
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/cross-in-circle.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/edit-in-square.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/half-clock.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/circle-reload.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/package.svg?react', () => ({
  default: () => <span />,
}));
vi.mock('@forethread/ui-components/assets/icons/search.svg?react', () => ({
  default: () => <span />,
}));

vi.mock('./LineItemExpandedRow', () => ({
  LineItemExpandedRow: () => <div data-testid="expanded-row" />,
}));

vi.mock('./MaterialSearchPopup', () => ({
  MaterialSearchPopup: () => <div data-testid="material-search-popup" />,
}));

import type { LineItemFormState, QuoteTotals } from '../hooks/useRfqResponse';

import { ResponseLineItemsTable } from './ResponseLineItemsTable';

const makeItem = (overrides: Partial<LineItemFormState> = {}): LineItemFormState => ({
  rfqLineItemId: 'li-1',
  included: true,
  materialName: 'Cement',
  materialId: 'mat-1',
  unit: 'kg',
  requestedQty: 100,
  availQty: '50',
  unitPrice: '10',
  discount: '',
  discountType: 'PERCENT',
  gst: '',
  taxIncluded: false,
  deliveryDate: '2026-06-01',
  notes: '',
  backOrderQty: '',
  backOrderDeliveryDate: '',
  substituteItemId: null,
  substituteName: null,
  expandedSection: null,
  description: null,
  expectedDeliveryDate: null,
  deliveryLocation: null,
  ...overrides,
});

const emptyTotals: QuoteTotals = {
  totalItemsQuoted: 0,
  totalItems: 1,
  subtotal: 0,
  discountTotal: 0,
  gstTotal: 0,
  totalQuote: 0,
};

const quotedTotals: QuoteTotals = {
  totalItemsQuoted: 1,
  totalItems: 1,
  subtotal: 500,
  discountTotal: 50,
  gstTotal: 45,
  totalQuote: 495,
};

describe('ResponseLineItemsTable', () => {
  const onToggleInclude = vi.fn();
  const onUpdateItem = vi.fn();
  const onToggleExpanded = vi.fn();
  const onOpenSubstitute = vi.fn();
  const onSubstituteQueryChange = vi.fn();
  const onCloseSubstitute = vi.fn();
  const onSelectSubstitute = vi.fn();

  const baseProps = {
    lineItems: [makeItem()],
    onToggleInclude,
    onUpdateItem,
    onToggleExpanded,
    totals: emptyTotals,
    substituteOpenIdx: null,
    substituteQuery: '',
    onSubstituteQueryChange,
    onOpenSubstitute,
    onCloseSubstitute,
    onSelectSubstitute,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section heading', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    expect(screen.getByText('response.lineItems')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    expect(screen.getByText('response.incl')).toBeInTheDocument();
    expect(screen.getByText('response.materialName')).toBeInTheDocument();
    expect(screen.getByText('response.uom')).toBeInTheDocument();
    expect(screen.getByText('response.reqQty')).toBeInTheDocument();
    expect(screen.getByText('response.unitPrice')).toBeInTheDocument();
    expect(screen.getByText('response.lineTotal')).toBeInTheDocument();
  });

  it('renders line item data', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    expect(screen.getByText('Cement')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('renders material as a link when materialId exists', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    const link = screen.getByText('Cement').closest('a');
    expect(link).toHaveAttribute('href', '/materials/mat-1');
  });

  it('renders material as plain text when no materialId', () => {
    const props = { ...baseProps, lineItems: [makeItem({ materialId: null })] };
    render(<ResponseLineItemsTable {...props} />);
    expect(screen.getByText('Cement').closest('a')).toBeNull();
  });

  it('renders toggle switch for include', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    expect(screen.getByTestId('toggle-switch')).toBeInTheDocument();
  });

  it('shows totalItems footer when no items quoted', () => {
    render(<ResponseLineItemsTable {...baseProps} totals={emptyTotals} />);
    expect(screen.getByText('response.totalItems')).toBeInTheDocument();
  });

  it('shows quoted totals footer when items are quoted', () => {
    render(<ResponseLineItemsTable {...baseProps} totals={quotedTotals} />);
    expect(screen.getByText('response.totalItemsQuoted')).toBeInTheDocument();
    expect(screen.getByText('response.subtotal')).toBeInTheDocument();
    expect(screen.getByText('response.totalQuote')).toBeInTheDocument();
  });

  it('renders expanded row when expandedSection is set', () => {
    const item = makeItem({ expandedSection: 'notes' });
    render(<ResponseLineItemsTable {...baseProps} lineItems={[item]} />);
    expect(screen.getByTestId('expanded-row')).toBeInTheDocument();
  });

  it('does not render expanded row when expandedSection is null', () => {
    render(<ResponseLineItemsTable {...baseProps} />);
    expect(screen.queryByTestId('expanded-row')).not.toBeInTheDocument();
  });

  it('renders substitute name when substituteItemId is set', () => {
    const item = makeItem({ substituteItemId: 'sub-1', substituteName: 'Alt Cement' });
    render(<ResponseLineItemsTable {...baseProps} lineItems={[item]} />);
    expect(screen.getByText('Alt Cement')).toBeInTheDocument();
  });
});
