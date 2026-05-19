import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import MaterialCataloguePage from './MaterialCataloguePage';

describe('MaterialCataloguePage', () => {
  it('renders the coming soon text', () => {
    render(<MaterialCataloguePage />);
    expect(screen.getByText('Coming soon.')).toBeInTheDocument();
  });
});
