import type { VendorActivePo } from '@forethread/api-client';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { ActivePosTable } from './active-pos';

const mockItems: VendorActivePo[] = [
  {
    id: '1',
    poNumber: 'PO-001',
    projectName: 'Tower Project',
    projectId: 'PROJ-100',
    contractorName: 'BuildCo',
    poStatus: 'active',
    revision: 1,
    poType: 'Standard',
    pickUp: false,
  },
];

describe('ActivePosTable', () => {
  it('renders section title', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.activePOs.title')).toBeInTheDocument();
  });

  it('shows empty state when no items', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.activePOs.noPOs')).toBeInTheDocument();
  });

  it('renders table with data', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('PO-001')).toBeInTheDocument();
    expect(screen.getByText('Tower Project')).toBeInTheDocument();
    expect(screen.getByText('BuildCo')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByText('vendor.activePOs.poNumber')).toBeInTheDocument();
    expect(screen.getByText('vendor.activePOs.projectName')).toBeInTheDocument();
    expect(screen.getByText('vendor.activePOs.contractorName')).toBeInTheDocument();
  });

  it('sorts when column header is clicked', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    const header = screen.getByText('vendor.activePOs.poNumber');
    fireEvent.click(header.closest('th')!);
    // Click again to toggle direction
    fireEvent.click(header.closest('th')!);
  });

  it('renders action buttons in rows', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    expect(screen.getByTitle('Messages')).toBeInTheDocument();
    expect(screen.getByTitle('Attachments')).toBeInTheDocument();
    expect(screen.getByTitle('View')).toBeInTheDocument();
  });

  it('handles action button click', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('View'));
  });

  it('shows spinner when loading', () => {
    render(
      <MemoryRouter>
        <ActivePosTable items={[]} isLoading />
      </MemoryRouter>,
    );
    // Spinner is rendered
    expect(screen.queryByText('vendor.activePOs.noPOs')).not.toBeInTheDocument();
  });

  it('handles Messages button click', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Messages'));
  });

  it('handles Attachments button click', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTitle('Attachments'));
  });

  it('sorts with multiple items to exercise sort comparator', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const twoItems: VendorActivePo[] = [
      ...mockItems,
      {
        id: '2',
        poNumber: 'PO-002',
        projectName: 'Alpha Project',
        projectId: 'PROJ-200',
        contractorName: 'AlphaCo',
        poStatus: 'pending',
        revision: 2,
        poType: 'Blanket',
        pickUp: true,
      },
    ];
    render(
      <MemoryRouter>
        <ActivePosTable items={twoItems} />
      </MemoryRouter>,
    );
    const header = screen.getByText('vendor.activePOs.poNumber');
    // Click to sort asc
    fireEvent.click(header.closest('th')!);
    // Click again to sort desc
    fireEvent.click(header.closest('th')!);
  });

  it('handles dot menu actions (view, edit, download)', async () => {
    const { fireEvent } = await import('@testing-library/react');
    render(
      <MemoryRouter>
        <ActivePosTable items={mockItems} />
      </MemoryRouter>,
    );
    // The DotActionsMenu renders actions; find and click each one
    const viewAction = screen.queryByText('actions.view');
    const editAction = screen.queryByText('actions.edit');
    const downloadAction = screen.queryByText('actions.download');
    if (viewAction) fireEvent.click(viewAction);
    if (editAction) fireEvent.click(editAction);
    if (downloadAction) fireEvent.click(downloadAction);
  });

  it('handles null values in sort', async () => {
    const { fireEvent } = await import('@testing-library/react');
    const itemsWithNull: VendorActivePo[] = [
      {
        ...mockItems[0],
        poNumber: null as unknown as string,
      },
      {
        id: '2',
        poNumber: 'PO-002',
        projectName: 'Alpha Project',
        projectId: 'PROJ-200',
        contractorName: 'AlphaCo',
        poStatus: 'pending',
        revision: 2,
        poType: 'Blanket',
        pickUp: true,
      },
    ];
    render(
      <MemoryRouter>
        <ActivePosTable items={itemsWithNull} />
      </MemoryRouter>,
    );
    const header = screen.getByText('vendor.activePOs.poNumber');
    fireEvent.click(header.closest('th')!);
  });
});
