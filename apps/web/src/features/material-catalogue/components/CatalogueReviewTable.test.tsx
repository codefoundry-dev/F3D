import type {
  CatalogueExtractionResult,
  CatalogueLineItem,
} from '@forethread/shared-types/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CatalogueReviewTable } from './CatalogueReviewTable';

function item(overrides: Partial<CatalogueLineItem> = {}): CatalogueLineItem {
  return {
    name: 'Widget',
    sku: 'SKU-1',
    brand: 'Acme',
    manufacturerPartNumber: null,
    upc: '012345678905',
    uom: 'EA',
    description: null,
    mainCategory: 'Hardware',
    subCategory: null,
    imageUrl: null,
    confidence: 0.9,
    ...overrides,
  };
}

function result(items: CatalogueLineItem[]): Record<string, unknown> {
  const value: CatalogueExtractionResult = { sourceName: 'file.xlsx', items, notes: null };
  return value as unknown as Record<string, unknown>;
}

describe('CatalogueReviewTable', () => {
  it('coerces malformed input into an empty catalogue', () => {
    render(<CatalogueReviewTable value={null} onChange={vi.fn()} />);
    expect(screen.getByTestId('catalogue-items-table')).toBeInTheDocument();
    expect(screen.queryByTestId('catalogue-row-0')).not.toBeInTheDocument();
  });

  it('renders rows and never shows the confidence value', () => {
    render(
      <CatalogueReviewTable
        value={result([item({ name: 'Hammer', confidence: 0.42 })])}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Hammer')).toBeInTheDocument();
    // 0.42 confidence must not surface anywhere.
    expect(screen.queryByText(/42/)).not.toBeInTheDocument();
  });

  it('paginates large item sets (only one page rendered at a time)', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      item({ name: `Item ${i}`, sku: `SKU-${i}` }),
    );
    render(<CatalogueReviewTable value={result(many)} onChange={vi.fn()} />);

    expect(screen.getByText('Item 0')).toBeInTheDocument();
    // Page size is 25 — Item 30 lives on a later page.
    expect(screen.queryByText('Item 30')).not.toBeInTheDocument();
  });

  it('filters by name/sku via the (debounced) search box', async () => {
    render(
      <CatalogueReviewTable
        value={result([item({ name: 'Hammer', sku: 'H-1' }), item({ name: 'Nail', sku: 'N-1' })])}
        onChange={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('catalogue-search'), { target: { value: 'nail' } });

    await waitFor(() => expect(screen.queryByText('Hammer')).not.toBeInTheDocument());
    expect(screen.getByText('Nail')).toBeInTheDocument();
  });

  it('emits an updated result when the category is edited inline', () => {
    const onChange = vi.fn();
    render(
      <CatalogueReviewTable
        value={result([item({ name: 'Hammer', mainCategory: 'Tools' })])}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Tools'), { target: { value: 'Power Tools' } });

    const next = onChange.mock.calls[0][0] as CatalogueExtractionResult;
    expect(next.items[0].mainCategory).toBe('Power Tools');
  });

  it('removes the row at the requested index', () => {
    const onChange = vi.fn();
    render(
      <CatalogueReviewTable
        value={result([item({ name: 'Hammer' }), item({ name: 'Nail' })])}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByTestId('catalogue-remove-row-0'));

    const next = onChange.mock.calls[0][0] as CatalogueExtractionResult;
    expect(next.items).toHaveLength(1);
    expect(next.items[0].name).toBe('Nail');
  });

  it('hides delete controls in read-only mode', () => {
    render(
      <CatalogueReviewTable value={result([item()])} readOnly onChange={vi.fn()} />,
    );
    expect(screen.queryByTestId('catalogue-remove-row-0')).not.toBeInTheDocument();
  });
});
