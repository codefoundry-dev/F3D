const mockPo = vi.hoisted(() => ({
  value: {
    data: { id: 'po-1', poNumber: 'PO-001', projectName: 'Test Project' } as Record<
      string,
      unknown
    > | null,
    isLoading: false,
  },
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'po-1' }),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/po-shared', () => ({
  usePurchaseOrder: () => mockPo.value,
}));

vi.mock('@forethread/ui-components', () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

import { render, screen } from '@testing-library/react';

import ChangeRequestPage from './ChangeRequestPage';

describe('ChangeRequestPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPo.value = {
      data: { id: 'po-1', poNumber: 'PO-001', projectName: 'Test Project' },
      isLoading: false,
    };
  });

  it('shows spinner when loading', () => {
    mockPo.value = { data: null, isLoading: true };
    render(<ChangeRequestPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('shows no data message when PO is not found', () => {
    mockPo.value = { data: null, isLoading: false };
    render(<ChangeRequestPage />);
    expect(screen.getByText('detail.noData')).toBeInTheDocument();
  });

  it('renders page title with project name', () => {
    render(<ChangeRequestPage />);
    expect(screen.getByText(/changeRequest.title/)).toBeInTheDocument();
    expect(screen.getByText(/Test Project/)).toBeInTheDocument();
  });

  it('renders placeholder text', () => {
    render(<ChangeRequestPage />);
    expect(screen.getByText('changeRequest.placeholder')).toBeInTheDocument();
  });
});
