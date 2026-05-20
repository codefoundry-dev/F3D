import { render, screen } from '@testing-library/react';

vi.mock('@forethread/profile-shared', () => ({
  UserProfilePage: () => <div data-testid="shared-user-profile-page" />,
}));

import UserProfilePage from './UserProfilePage';

describe('UserProfilePage (apps/web re-export)', () => {
  it('renders the shared UserProfilePage', () => {
    render(<UserProfilePage />);
    expect(screen.getByTestId('shared-user-profile-page')).toBeInTheDocument();
  });
});
