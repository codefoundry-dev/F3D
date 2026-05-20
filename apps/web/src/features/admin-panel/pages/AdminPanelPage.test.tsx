import { render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

import AdminPanelPage from './AdminPanelPage';

describe('AdminPanelPage', () => {
  it('renders the External Integrations card', () => {
    render(<AdminPanelPage />);
    expect(screen.getByText('External Integrations')).toBeInTheDocument();
    expect(
      screen.getByText('ERP, accounting, inventory, email ingestion status.'),
    ).toBeInTheDocument();
  });

  it('renders the Background Jobs card', () => {
    render(<AdminPanelPage />);
    expect(screen.getByText('Background Jobs')).toBeInTheDocument();
    expect(
      screen.getByText('OCR processing, email ingestion, synchronization tasks.'),
    ).toBeInTheDocument();
  });

  it('renders the Notification Delivery card', () => {
    render(<AdminPanelPage />);
    expect(screen.getByText('Notification Delivery')).toBeInTheDocument();
    expect(screen.getByText('Email service and in-app delivery monitoring.')).toBeInTheDocument();
  });

  it('renders the coming-soon caption on each card', () => {
    render(<AdminPanelPage />);
    expect(screen.getAllByText('Detailed view coming soon.')).toHaveLength(3);
  });
});
