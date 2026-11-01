import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyRow, type BomDraftRow } from './bom-draft';
import { BomReviewStep } from './BomReviewStep';

// ADR-0019 B10 (FOR-376): on phones the BOM grid is a card per line plus the
// shared line sheet, built from the same field definitions as the table.
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@forethread/api-client', () => ({ getMaterialCategories: vi.fn(async () => []) }));
vi.mock('../../hooks/useMaterialSearchQuery', () => ({
  useMaterialSearchQuery: () => ({ results: [], totalCount: 0 }),
}));

const realMatchMedia = window.matchMedia;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

function Harness({ initial }: { initial: BomDraftRow[] }) {
  const [rows, setRows] = useState(initial);
  return <BomReviewStep rows={rows} onRowsChange={setRows} />;
}

function renderStep(initial: BomDraftRow[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness initial={initial} />
    </QueryClientProvider>,
  );
}

describe('BomReviewStep on phones', () => {
  const row: BomDraftRow = {
    ...emptyRow(),
    materialName: 'Copper pipe 15mm',
    uom: 'm',
    quantity: '12',
  };

  it('renders cards instead of the table', () => {
    renderStep([row]);
    expect(screen.queryByTestId('bom-review-table')).not.toBeInTheDocument();
    const cards = screen.getAllByTestId('line-item-card');
    // The real line plus the trailing empty add-row.
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Copper pipe 15mm');
    expect(cards[0]).toHaveTextContent('12');
    // Unmatched lines are flagged on the card in the create wizard.
    expect(cards[0].className).toContain('border-destructive');
  });

  it('edits a line in the sheet', () => {
    renderStep([row]);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    const sheet = screen.getByTestId('line-item-sheet').closest('[role="dialog"]') as HTMLElement;
    fireEvent.change(within(sheet).getByLabelText('create.columns.quantity'), {
      target: { value: '20' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.getAllByTestId('line-item-card')[0]).toHaveTextContent('20');
  });
});
