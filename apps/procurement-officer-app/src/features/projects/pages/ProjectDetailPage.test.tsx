vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'proj-123' }),
}));

import { render, screen } from '@testing-library/react';

import ProjectDetailPage from './ProjectDetailPage';

describe('ProjectDetailPage', () => {
  it('renders project id and coming soon', () => {
    render(<ProjectDetailPage />);
    expect(screen.getByText(/proj-123/)).toBeInTheDocument();
    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
