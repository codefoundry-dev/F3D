import { LineItemEditor, type LineItemField } from '@forethread/ui-components';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

// ADR-0019 B10 (FOR-376): phone input grids become cards + an edit sheet that
// reuses the grid's own field definitions.
interface Line {
  name: string;
  qty: number;
}

function Grid({ validate }: { validate?: (i: number) => boolean }) {
  const [lines, setLines] = useState<Line[]>([
    { name: 'Copper pipe', qty: 4 },
    { name: 'Elbow joint', qty: 10 },
  ]);
  const fields: LineItemField<Line>[] = [
    {
      key: 'qty',
      label: 'Qty',
      required: true,
      value: (l) => l.qty,
      input: (l, i) => (
        <input
          aria-label={`qty-${i}`}
          value={l.qty}
          onChange={(e) =>
            setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))
          }
        />
      ),
    },
  ];
  return (
    <LineItemEditor
      lines={lines}
      fields={fields}
      getKey={(l) => l.name}
      getTitle={(l) => l.name}
      validateLine={validate}
      onRemove={(i) => setLines((ls) => ls.filter((_, j) => j !== i))}
    />
  );
}

describe('LineItemEditor (B10)', () => {
  it('shows a card per line with its summary values', () => {
    render(<Grid />);
    const cards = screen.getAllByTestId('line-item-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('Copper pipe');
    expect(cards[0]).toHaveTextContent('4');
  });

  it('edits a line in the sheet and walks Previous / Next', () => {
    render(<Grid />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    const sheet = () => screen.getByRole('dialog');
    expect(within(sheet()).getByText('Line 1 of 2')).toBeInTheDocument();
    expect(within(sheet()).getByRole('button', { name: /Previous/ })).toBeDisabled();

    fireEvent.change(within(sheet()).getByLabelText('qty-0'), { target: { value: '7' } });
    fireEvent.click(within(sheet()).getByRole('button', { name: /Next/ }));
    expect(within(sheet()).getByText('Line 2 of 2')).toBeInTheDocument();
    expect(within(sheet()).getByRole('button', { name: /Next/ })).toBeDisabled();

    fireEvent.click(within(sheet()).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('line-item-card')[0]).toHaveTextContent('7');
  });

  it('keeps the sheet open while the line is invalid', () => {
    const validate = vi.fn(() => false);
    render(<Grid validate={validate} />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(validate).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('line-item-sheet')).toBeInTheDocument();
  });

  it('removes a line from the sheet', () => {
    render(<Grid />);
    fireEvent.click(screen.getAllByTestId('line-item-card')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove line' }));
    expect(screen.getAllByTestId('line-item-card')).toHaveLength(1);
  });
});
