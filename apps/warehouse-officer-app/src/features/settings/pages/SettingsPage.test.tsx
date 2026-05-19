import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import SettingsPage from './SettingsPage';

describe('SettingsPage', () => {
  it('renders coming soon text', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Settings page coming soon.')).toBeInTheDocument();
  });
});
