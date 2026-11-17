import { fireEvent, render, screen, within } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));
vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button onClick={p.onClick} data-testid={p['data-testid']}>
      {p.children}
    </button>
  ),
  GridModal: (p: any) => (
    <div role="dialog">
      <h2>{p.title}</h2>
      <p>{p.description}</p>
      {p.children}
      {p.actions}
    </div>
  ),
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <svg />,
}));

import { emptyRow, type BomDraftRow } from './bom-draft';
import { UnmatchedItemsModal } from './UnmatchedItemsModal';

function row(overrides: Partial<BomDraftRow> = {}): BomDraftRow {
  return { ...emptyRow(), ...overrides };
}

const rows = [
  row({ materialName: 'Steel Bar', matchedMaterialId: 'm1', matchedMaterialName: 'Steel Bar' }),
  row({ materialName: 'Ladder 4/70 90D Bend', quantity: '6', uom: 'EA' }),
  row({ materialName: '', description: 'Cover Peak 30D' }),
  emptyRow(),
];

describe('UnmatchedItemsModal', () => {
  it('lists only the lines that have no catalogue match', () => {
    render(
      <UnmatchedItemsModal
        rows={rows}
        confirmLabel="Continue anyway"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('unmatchedModal.title:2')).toBeInTheDocument();
    const items = within(screen.getByTestId('bom-unmatched-list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ladder 4/70 90D Bend');
    expect(items[0]).toHaveTextContent('6 EA');
    // Falls back to the description when the line has no name.
    expect(items[1]).toHaveTextContent('Cover Peak 30D');
    expect(screen.queryByText('Steel Bar')).not.toBeInTheDocument();
  });

  it('proceeds on confirm and goes back on close', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <UnmatchedItemsModal
        rows={rows}
        confirmLabel="Continue anyway"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByText('Continue anyway'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('bom-unmatched-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
