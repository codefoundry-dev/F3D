import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('renders settings subtitle', () => {
    render(<SettingsPage />);
    expect(screen.getByText('settingsSubtitle')).toBeInTheDocument();
  });
});
