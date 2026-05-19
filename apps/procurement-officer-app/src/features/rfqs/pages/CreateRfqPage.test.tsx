vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { render, screen } from '@testing-library/react';

import CreateRfqPage from './CreateRfqPage';

describe('CreateRfqPage', () => {
  it('renders under development text', () => {
    render(<CreateRfqPage />);
    expect(screen.getByText(/RFQ creation will be available soon/i)).toBeInTheDocument();
  });
});
