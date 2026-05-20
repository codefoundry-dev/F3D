import { render, screen } from '@testing-library/react';

import MaterialCataloguePage from './MaterialCataloguePage';

describe('MaterialCataloguePage', () => {
  it('renders the coming soon text', () => {
    render(<MaterialCataloguePage />);
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
