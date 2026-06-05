import type { BomExtractionResult, BomLineItem } from '@forethread/shared-types/client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BomReviewTable } from './BomReviewTable';

function emptyBom(): BomExtractionResult {
  return { title: null, projectName: null, currency: null, items: [], notes: null };
}

function bomWith(items: BomLineItem[]): Record<string, unknown> {
  return { ...emptyBom(), items } as unknown as Record<string, unknown>;
}

describe('BomReviewTable', () => {
  it('coerces malformed input into the empty BOM shape', () => {
    const onChange = vi.fn();
    render(<BomReviewTable value={null} onChange={onChange} />);

    expect(screen.getByTestId('bom-items-table')).toBeInTheDocument();
    expect(screen.queryByTestId('bom-row-0')).not.toBeInTheDocument();
  });

  it('renders one row per BOM line item', () => {
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [
        { description: 'Cement', quantity: 50, unit: 'bag', targetPrice: 12.5, notes: null },
        { description: 'Rebar', quantity: 1200, unit: 'm', targetPrice: 2.15, notes: 'grade 60' },
      ],
    };
    render(
      <BomReviewTable value={value as unknown as Record<string, unknown>} onChange={vi.fn()} />,
    );

    expect(screen.getByTestId('bom-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('bom-row-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Cement')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rebar')).toBeInTheDocument();
  });

  it('emits the updated BOM shape when an input changes', () => {
    const onChange = vi.fn();
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [{ description: 'Cement', quantity: 50, unit: 'bag', targetPrice: null, notes: null }],
    };
    render(
      <BomReviewTable value={value as unknown as Record<string, unknown>} onChange={onChange} />,
    );

    fireEvent.change(screen.getByDisplayValue('Cement'), {
      target: { value: 'Cement 25kg bag' },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as BomExtractionResult;
    expect(next.items[0].description).toBe('Cement 25kg bag');
    expect(next.items[0].quantity).toBe(50);
  });

  it('parses quantity input as a number (strips commas / currency symbols)', () => {
    const onChange = vi.fn();
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [{ description: 'Rebar', quantity: 0, unit: null, targetPrice: null, notes: null }],
    };
    render(
      <BomReviewTable value={value as unknown as Record<string, unknown>} onChange={onChange} />,
    );

    const qtyInput = screen.getByLabelText(/qty/i);
    fireEvent.change(qtyInput, { target: { value: '1,200' } });

    const next = onChange.mock.calls[onChange.mock.calls.length - 1][0] as BomExtractionResult;
    expect(next.items[0].quantity).toBe(1200);
  });

  it('appends a blank row on "Add row"', () => {
    const onChange = vi.fn();
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [{ description: 'Cement', quantity: 50, unit: 'bag', targetPrice: 12.5, notes: null }],
    };
    render(
      <BomReviewTable value={value as unknown as Record<string, unknown>} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('bom-add-row'));

    const next = onChange.mock.calls[0][0] as BomExtractionResult;
    expect(next.items).toHaveLength(2);
    expect(next.items[1]).toEqual({
      description: '',
      quantity: null,
      unit: null,
      targetPrice: null,
      notes: null,
    });
  });

  it('removes the row at the requested index', () => {
    const onChange = vi.fn();
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [
        { description: 'Cement', quantity: 50, unit: 'bag', targetPrice: 12.5, notes: null },
        { description: 'Rebar', quantity: 1200, unit: 'm', targetPrice: 2.15, notes: null },
      ],
    };
    render(
      <BomReviewTable value={value as unknown as Record<string, unknown>} onChange={onChange} />,
    );

    fireEvent.click(screen.getByTestId('bom-remove-row-0'));

    const next = onChange.mock.calls[0][0] as BomExtractionResult;
    expect(next.items).toHaveLength(1);
    expect(next.items[0].description).toBe('Rebar');
  });

  describe('catalogue match column', () => {
    const autoMatched: BomLineItem = {
      description: 'Cement',
      quantity: 50,
      unit: 'bag',
      targetPrice: null,
      notes: null,
      matchedMaterialId: 'm-cement',
      matchedMaterialName: 'Cement Bag 50kg',
      matchConfidence: 0.92,
      matchCandidates: [{ materialId: 'm-cement', name: 'Cement Bag 50kg', confidence: 0.92 }],
    };
    const lowConfidence: BomLineItem = {
      description: 'Concrete Mix',
      quantity: 10,
      unit: 'm3',
      targetPrice: null,
      notes: null,
      matchedMaterialId: null,
      matchedMaterialName: null,
      matchConfidence: null,
      matchCandidates: [{ materialId: 'm-c30', name: 'Concrete Mix Grade 30', confidence: 0.67 }],
    };
    const unmatched: BomLineItem = {
      description: 'Mystery widget',
      quantity: 1,
      unit: 'ea',
      targetPrice: null,
      notes: null,
      matchedMaterialId: null,
      matchedMaterialName: null,
      matchConfidence: null,
      matchCandidates: [],
    };

    it('shows confidence %, a review suggestion, and "No match" per line', () => {
      render(
        <BomReviewTable
          value={bomWith([autoMatched, lowConfidence, unmatched])}
          readOnly
          onChange={vi.fn()}
        />,
      );

      const matched = within(screen.getByTestId('bom-match-0'));
      expect(matched.getByText('92%')).toBeInTheDocument();
      expect(matched.getByText('Cement Bag 50kg')).toBeInTheDocument();

      const review = within(screen.getByTestId('bom-match-1'));
      expect(review.getByText('Review')).toBeInTheDocument();
      expect(review.getByText(/Concrete Mix Grade 30 \(67%\)/)).toBeInTheDocument();

      const none = within(screen.getByTestId('bom-match-2'));
      expect(none.getByText('No match')).toBeInTheDocument();
    });

    it('does not render the picker in read-only mode', () => {
      render(<BomReviewTable value={bomWith([unmatched])} readOnly onChange={vi.fn()} />);
      expect(
        within(screen.getByTestId('bom-match-0')).queryByRole('button'),
      ).not.toBeInTheDocument();
    });

    it('emits a manual match (confidence cleared) when a material is picked', () => {
      const onChange = vi.fn();
      const options = [
        { value: 'm-cement', label: 'Cement Bag 50kg' },
        { value: 'm-steel', label: 'Steel Rebar 12mm' },
      ];
      render(
        <BomReviewTable
          value={bomWith([unmatched])}
          onChange={onChange}
          materialOptions={options}
        />,
      );

      // Open the per-row picker, then choose a catalogue material.
      fireEvent.click(within(screen.getByTestId('bom-match-0')).getByRole('button'));
      fireEvent.click(screen.getByRole('option', { name: 'Steel Rebar 12mm' }));

      const next = onChange.mock.calls[onChange.mock.calls.length - 1][0] as BomExtractionResult;
      expect(next.items[0]).toMatchObject({
        matchedMaterialId: 'm-steel',
        matchedMaterialName: 'Steel Rebar 12mm',
        matchConfidence: null,
      });
    });
  });

  it('disables add / remove controls when readOnly', () => {
    const value: BomExtractionResult = {
      ...emptyBom(),
      items: [{ description: 'Cement', quantity: 50, unit: 'bag', targetPrice: 12.5, notes: null }],
    };
    render(
      <BomReviewTable
        value={value as unknown as Record<string, unknown>}
        readOnly
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('bom-add-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bom-remove-row-0')).not.toBeInTheDocument();
  });
});
