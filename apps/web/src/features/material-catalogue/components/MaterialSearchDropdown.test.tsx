import { type MaterialSuggestionDto } from '@forethread/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialSearchDropdown } from './MaterialSearchDropdown';

function suggestion(over: Partial<MaterialSuggestionDto> = {}): MaterialSuggestionDto {
  return {
    id: 'm-1',
    name: 'Paint Primer White 5-Gal',
    categoryName: 'Paint & coatings',
    uom: 'gal',
    description: 'Interior/exterior primer',
    imageUrl: null,
    ...over,
  };
}

function renderDropdown(props: Partial<React.ComponentProps<typeof MaterialSearchDropdown>> = {}) {
  const onSelect = vi.fn();
  render(
    <MaterialSearchDropdown
      query="paint"
      results={[]}
      frequentlyUsed={[]}
      recentlyUsed={[]}
      isLoading={false}
      onSelect={onSelect}
      {...props}
    />,
  );
  return { onSelect };
}

describe('MaterialSearchDropdown', () => {
  it('shows the result count header from the explicit count', () => {
    renderDropdown({ results: [suggestion()], resultCount: 1000 });
    expect(screen.getByTestId('material-search-count')).toHaveTextContent('1000 results');
  });

  it('renders a result row with name, category chip, uom and description', () => {
    renderDropdown({ results: [suggestion()] });
    const row = screen.getByTestId('material-search-result-m-1');
    expect(row).toHaveTextContent('Paint Primer White 5-Gal');
    expect(row).toHaveTextContent('Paint & coatings');
    expect(row).toHaveTextContent('gal');
    expect(row).toHaveTextContent('Interior/exterior primer');
    expect(screen.getByTestId('material-search-view-m-1')).toBeInTheDocument();
  });

  it('falls back to the unit-of-measures placeholder when uom is blank', () => {
    renderDropdown({ results: [suggestion({ uom: null })] });
    expect(screen.getByTestId('material-search-result-m-1')).toHaveTextContent('Unit of measures');
  });

  it('only renders the Frequently used / Recently used groups when they have items', () => {
    renderDropdown({
      results: [suggestion({ id: 'r-1' })],
      frequentlyUsed: [],
      recentlyUsed: [suggestion({ id: 'rec-1', name: 'Recent material' })],
    });
    expect(screen.getByTestId('material-search-group-results')).toBeInTheDocument();
    expect(screen.queryByTestId('material-search-group-frequent')).not.toBeInTheDocument();
    expect(screen.getByTestId('material-search-group-recent')).toBeInTheDocument();
    expect(screen.getByText('Recently used')).toBeInTheDocument();
    expect(screen.queryByText('Frequently used')).not.toBeInTheDocument();
  });

  it('invokes onSelect with the material id + name when a row is pressed', () => {
    const { onSelect } = renderDropdown({ results: [suggestion()] });
    fireEvent.mouseDown(screen.getByTestId('material-search-result-m-1'));
    expect(onSelect).toHaveBeenCalledWith({ id: 'm-1', name: 'Paint Primer White 5-Gal' });
  });

  it('shows an empty message when there are no suggestions at all', () => {
    renderDropdown({ results: [], resultCount: 0 });
    expect(screen.getByText('No suggestions for "paint".')).toBeInTheDocument();
  });
});
