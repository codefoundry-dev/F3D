import type { BomExtractionResult } from '@forethread/shared-types/client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BomReviewTable } from './BomReviewTable';

function emptyBom(): BomExtractionResult {
  return { title: null, projectName: null, currency: null, items: [], notes: null };
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
