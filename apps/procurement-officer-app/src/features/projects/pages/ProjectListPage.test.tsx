vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { render, screen } from '@testing-library/react';

import ProjectListPage from './ProjectListPage';

describe('ProjectListPage', () => {
  it('renders title and coming soon', () => {
    render(<ProjectListPage />);
    expect(screen.getByText('list.title')).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
