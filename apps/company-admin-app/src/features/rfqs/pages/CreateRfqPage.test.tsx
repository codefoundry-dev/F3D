import { render, screen } from '@testing-library/react';

import CreateRfqPage from './CreateRfqPage';

describe('CreateRfqPage', () => {
  it('renders coming soon message', () => {
    render(<CreateRfqPage />);
    expect(screen.getByText(/under development/i)).toBeInTheDocument();
  });
});
