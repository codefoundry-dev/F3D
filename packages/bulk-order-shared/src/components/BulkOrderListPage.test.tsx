/* eslint-disable @typescript-eslint/no-explicit-any */
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks/useFilterOptions', () => ({
  useProjectFilterOptions: () => [],
  useVendorFilterOptions: () => [],
  useContractorFilterOptions: () => [],
}));

vi.mock('../hooks/useBulkOrderListState', () => ({
  useBulkOrderListState: () => ({
    page: 1,
    setPage: vi.fn(),
    pageSize: 25,
    setPageSize: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    sortBy: 'id',
    sortDir: 'asc',
    handleSort: vi.fn(),
    projectFilter: [],
    handleProjectFilterChange: vi.fn(),
    counterpartyFilter: [],
    handleCounterpartyFilterChange: vi.fn(),
    items: [],
    totalCount: 0,
    isLoading: false,
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  TablePagination: () => <div data-testid="pagination" />,
}));

vi.mock('./AllChangeHistorySection', () => ({
  AllChangeHistorySection: () => <div data-testid="change-history" />,
}));
vi.mock('./BulkOrderTable', () => ({ BulkOrderTable: () => <div data-testid="table" /> }));
vi.mock('./BulkOrderToolbar', () => ({
  BulkOrderToolbar: ({ onCreateNew }: any) => (
    <button data-testid="create-new" onClick={onCreateNew}>
      create
    </button>
  ),
}));

import { fireEvent, render, screen } from '@testing-library/react';

import { BulkOrderListPage } from './BulkOrderListPage';

beforeEach(() => mockNavigate.mockReset());

describe('BulkOrderListPage', () => {
  it('navigates to the create page when Create new is clicked', () => {
    render(<BulkOrderListPage />);
    fireEvent.click(screen.getByTestId('create-new'));
    expect(mockNavigate).toHaveBeenCalledWith('/bulk-orders/new');
  });

  it('hides the create action when hideCreate is set', () => {
    render(<BulkOrderListPage hideCreate />);
    // Toolbar receives undefined onCreateNew; clicking the stub does nothing.
    fireEvent.click(screen.getByTestId('create-new'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
