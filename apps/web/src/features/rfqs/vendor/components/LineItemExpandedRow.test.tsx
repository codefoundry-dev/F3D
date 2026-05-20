import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/ui-components', () => ({
  DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="date-picker" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
  StepperInput: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <input
      data-testid="stepper-input"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
  Textarea: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
  }) => (
    <textarea data-testid="textarea" value={value} onChange={onChange} placeholder={placeholder} />
  ),
}));

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <span data-testid="delete-icon" />,
}));

import type { LineItemFormState } from '../hooks/useRfqResponse';

import { LineItemExpandedRow } from './LineItemExpandedRow';

const makeItem = (overrides: Partial<LineItemFormState> = {}): LineItemFormState => ({
  rfqLineItemId: 'li-1',
  included: true,
  materialName: 'Cement',
  materialId: null,
  unit: 'kg',
  requestedQty: 100,
  availQty: '50',
  unitPrice: '10',
  discount: '',
  discountType: 'PERCENT',
  gst: '',
  taxIncluded: false,
  deliveryDate: '',
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

describe('LineItemExpandedRow', () => {
  const onUpdateItem = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notes section', () => {
    it('renders line notes textarea', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="notes"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.getByText('response.lineNotes')).toBeInTheDocument();
      expect(screen.getByTestId('textarea')).toBeInTheDocument();
    });

    it('renders optional label', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="notes"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.getByText('response.optional')).toBeInTheDocument();
    });

    it('renders contractor notes when description exists', () => {
      const item = makeItem({ description: 'Special instructions' });
      render(
        <LineItemExpandedRow item={item} index={0} section="notes" onUpdateItem={onUpdateItem} />,
      );
      expect(screen.getByText('response.contractorNotes')).toBeInTheDocument();
      expect(screen.getByText('Special instructions')).toBeInTheDocument();
    });

    it('does not render contractor notes when description is null', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="notes"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.queryByText('response.contractorNotes')).not.toBeInTheDocument();
    });

    it('shows delete button when notes have content', () => {
      const item = makeItem({ notes: 'Some note' });
      render(
        <LineItemExpandedRow item={item} index={0} section="notes" onUpdateItem={onUpdateItem} />,
      );
      expect(screen.getByTestId('delete-icon')).toBeInTheDocument();
    });

    it('clears notes when delete button is clicked', () => {
      const item = makeItem({ notes: 'Some note' });
      render(
        <LineItemExpandedRow item={item} index={0} section="notes" onUpdateItem={onUpdateItem} />,
      );
      const deleteBtn = screen.getByTestId('delete-icon').closest('button')!;
      fireEvent.click(deleteBtn);
      expect(onUpdateItem).toHaveBeenCalledWith(0, 'notes', '');
    });

    it('calls onUpdateItem when textarea changes', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="notes"
          onUpdateItem={onUpdateItem}
        />,
      );
      fireEvent.change(screen.getByTestId('textarea'), { target: { value: 'New note' } });
      expect(onUpdateItem).toHaveBeenCalledWith(0, 'notes', 'New note');
    });
  });

  describe('backorder section', () => {
    it('renders back-order details heading', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="backorder"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.getByText('response.backOrderDetails')).toBeInTheDocument();
      expect(screen.getByText('response.backOrderSubtitle')).toBeInTheDocument();
    });

    it('renders qty stepper input and date picker', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="backorder"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.getByText('response.backOrderQty')).toBeInTheDocument();
      expect(screen.getByTestId('stepper-input')).toBeInTheDocument();
      expect(screen.getByText('response.expectedDeliveryDate')).toBeInTheDocument();
      expect(screen.getByTestId('date-picker')).toBeInTheDocument();
    });

    it('renders the hint text', () => {
      render(
        <LineItemExpandedRow
          item={makeItem()}
          index={0}
          section="backorder"
          onUpdateItem={onUpdateItem}
        />,
      );
      expect(screen.getByText('response.backOrderHint')).toBeInTheDocument();
    });
  });
});
