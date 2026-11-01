import type { ProjectListItem } from '@forethread/api-client';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StepLineItems } from './StepLineItems';
import type { WizardLineItem } from './wizard-types';

// ADR-0019 B10 (FOR-376): on phones the RFQ line grid is a card list per
// project group plus the shared line sheet.
vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));
vi.mock('../../services/rfqs.service', () => ({
  useRfqMaterialSuggestions: () => ({ data: undefined, isLoading: false }),
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

const projects = [{ id: 'p1', name: 'Alpha Construction' }] as ProjectListItem[];

function Harness({ initial }: { initial: WizardLineItem[] }) {
  const [items, setItems] = useState(initial);
  return (
    <>
      <StepLineItems
        items={items}
        onItemsChange={setItems}
        projects={projects}
        materials={[]}
        search=""
        onSearchChange={() => undefined}
        onOpenAddFromBom={() => undefined}
        onOpenAddFromMaterialList={() => undefined}
        onCheckAvailability={() => undefined}
        availabilityChecked={false}
        availabilityLoading={false}
        allocations={new Map()}
        onAllocationsChange={() => undefined}
      />
      <output data-testid="state">{JSON.stringify(items)}</output>
    </>
  );
}

const line: WizardLineItem = {
  key: 'l1',
  source: 'CATALOG',
  materialId: 'm1',
  materialName: 'Copper pipe',
  quantity: 4,
  uom: 'm',
  projectId: 'p1',
};

describe('StepLineItems on phones', () => {
  it('shows a card per line under its project instead of the table', () => {
    render(<Harness initial={[line]} />);
    expect(screen.queryByTestId('line-items-table')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha Construction')).toBeInTheDocument();
    const [card] = screen.getAllByTestId('line-item-card');
    expect(card).toHaveTextContent('Copper pipe');
    expect(card).toHaveTextContent('4');
  });

  it('edits quantity in the sheet', () => {
    render(<Harness initial={[line]} />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    const sheet = screen.getByTestId('line-item-sheet').closest('[role="dialog"]') as HTMLElement;
    fireEvent.change(within(sheet).getByTestId('line-uom-l1'), { target: { value: 'pcs' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.getAllByTestId('line-item-card')[0]).toHaveTextContent('pcs');
  });

  it('adds a manual line and blocks Save until it is complete', () => {
    render(<Harness initial={[line]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add line' }));
    const sheet = screen.getByTestId('line-item-sheet').closest('[role="dialog"]') as HTMLElement;
    expect(within(sheet).getByText('Line 2 of 2')).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.getByTestId('line-item-sheet')).toBeInTheDocument();
    expect(
      within(sheet).getByText('Add a name, a quantity and a unit to save this line.'),
    ).toBeInTheDocument();

    const key = (JSON.parse(screen.getByTestId('state').textContent ?? '[]') as WizardLineItem[])[1]
      .key;
    fireEvent.change(within(sheet).getByTestId(`line-name-${key}`), {
      target: { value: 'Elbow joint' },
    });
    fireEvent.change(within(sheet).getByTestId(`line-uom-${key}`), { target: { value: 'pcs' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(screen.queryByTestId('line-item-sheet')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('line-item-card')[1]).toHaveTextContent('Elbow joint');
  });
});
