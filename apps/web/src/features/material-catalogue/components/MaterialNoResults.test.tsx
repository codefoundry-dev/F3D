import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MaterialNoResults } from './MaterialNoResults';

describe('MaterialNoResults', () => {
  it('renders the heading and a query-aware message', () => {
    render(<MaterialNoResults query="hydraulic cement" />);

    expect(screen.getByTestId('material-no-results')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No results found' })).toBeInTheDocument();
    expect(
      screen.getByText(/We couldn't find any results matching "hydraulic cement"\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Try adjusting your search or filters/)).toBeInTheDocument();
  });
});
