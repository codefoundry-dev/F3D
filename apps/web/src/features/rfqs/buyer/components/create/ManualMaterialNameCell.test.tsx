import type { MaterialSuggestionDto } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

const mockUseRfqMaterialSuggestions = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && 'count' in opts ? `${key}:${String(opts.count)}` : key,
  }),
}));

vi.mock('../../services/rfqs.service', () => ({
  useRfqMaterialSuggestions: mockUseRfqMaterialSuggestions,
}));

// Identity debounce so the popup term tracks the input synchronously.
vi.mock('@forethread/ui-components', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useDebounce: (value: unknown) => value,
}));

import { ManualMaterialNameCell } from './ManualMaterialNameCell';

const steel = {
  id: 'm-1',
  name: 'Steel Beam',
  categoryName: 'Structural',
  uom: 'unit',
  description: 'H-beam',
  imageUrl: null,
};

const emptyGroups = { results: [], frequentlyUsed: [], recentlyUsed: [] };

function Harness({
  onSelectMaterial = vi.fn(),
  onCommit = vi.fn(),
  onValueChange,
}: {
  onSelectMaterial?: (material: MaterialSuggestionDto) => void;
  onCommit?: () => void;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <ManualMaterialNameCell
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onValueChange?.(v);
      }}
      onSelectMaterial={onSelectMaterial}
      onCommit={onCommit}
      placeholder="Enter material name"
      testId="manual-name"
    />
  );
}

describe('ManualMaterialNameCell', () => {
  beforeEach(() => {
    mockUseRfqMaterialSuggestions.mockReset();
    mockUseRfqMaterialSuggestions.mockReturnValue({
      data: { ...emptyGroups, results: [steel] },
      isLoading: false,
    });
  });

  function typeIntoInput(text: string) {
    const input = screen.getByTestId('manual-name');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: text } });
    return input;
  }

  it('shows catalogue suggestions anchored to the input while typing', () => {
    render(<Harness />);

    expect(screen.queryByTestId('material-name-dropdown')).not.toBeInTheDocument();
    typeIntoInput('steel');

    expect(mockUseRfqMaterialSuggestions).toHaveBeenLastCalledWith('steel');
    expect(screen.getByTestId('material-name-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('material-name-suggestion-m-1')).toHaveTextContent('Steel Beam');
    expect(screen.getByText('search.resultCount:1')).toBeInTheDocument();
  });

  it('does not query while the popup is closed', () => {
    render(<Harness />);
    expect(mockUseRfqMaterialSuggestions).toHaveBeenLastCalledWith('');
  });

  it('picking a suggestion reports the material and closes the popup', () => {
    const onSelectMaterial = vi.fn();
    const onCommit = vi.fn();
    render(<Harness onSelectMaterial={onSelectMaterial} onCommit={onCommit} />);

    typeIntoInput('steel');
    fireEvent.mouseDown(screen.getByTestId('material-name-suggestion-m-1'));

    expect(onSelectMaterial).toHaveBeenCalledWith(steel);
    expect(screen.queryByTestId('material-name-dropdown')).not.toBeInTheDocument();
    // The pick must not blur-commit the still-incomplete draft row.
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the draft and closes the popup on blur', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const input = typeIntoInput('steel');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('material-name-dropdown')).not.toBeInTheDocument();
  });

  it('closes the popup on Escape without committing', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const input = typeIntoInput('steel');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('material-name-dropdown')).not.toBeInTheDocument();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('renders the usage groups and the empty state', () => {
    mockUseRfqMaterialSuggestions.mockReturnValue({
      data: { results: [], frequentlyUsed: [steel], recentlyUsed: [] },
      isLoading: false,
    });
    render(<Harness />);
    typeIntoInput('ste');
    expect(screen.getByTestId('material-name-group-frequent')).toBeInTheDocument();

    mockUseRfqMaterialSuggestions.mockReturnValue({ data: emptyGroups, isLoading: false });
    typeIntoInput('nope');
    expect(screen.getByText('search.noSuggestions')).toBeInTheDocument();
  });
});
