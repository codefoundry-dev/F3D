import { render, screen } from '@testing-library/react';

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('renders settings page content', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings page coming soon.')).toBeInTheDocument();
  });
});
