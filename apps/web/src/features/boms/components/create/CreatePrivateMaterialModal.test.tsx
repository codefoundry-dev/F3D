import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';

const mockApi = vi.hoisted(() => ({
  getMaterialCategories: vi.fn(),
  createMaterial: vi.fn(),
}));
const mockNotify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/api-client', () => mockApi);

vi.mock('@forethread/ui-components', () => ({
  Button: (p: any) => (
    <button
      onClick={p.onClick}
      disabled={!!p.disabled || !!p.isLoading}
      {...(p['data-testid'] ? { 'data-testid': p['data-testid'] } : {})}
    >
      {p.children}
    </button>
  ),
  Input: (p: any) => (
    <input
      value={p.value}
      onChange={p.onChange}
      aria-label={p['aria-label']}
      data-testid={p['data-testid']}
    />
  ),
  Textarea: (p: any) => (
    <textarea
      value={p.value}
      onChange={p.onChange}
      aria-label={p['aria-label']}
      data-testid={p['data-testid']}
    />
  ),
  Modal: (p: any) => <div data-testid="modal">{p.children}</div>,
  FormField: (p: any) => (
    <label>
      {p.label}
      {p.children}
    </label>
  ),
  CustomDropdown: (p: any) => (
    <select aria-label={p.placeholder} value={p.value} onChange={(e) => p.onChange(e.target.value)}>
      {(p.options ?? []).map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
  notificationService: mockNotify,
}));

import { CreatePrivateMaterialModal } from './CreatePrivateMaterialModal';

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const NEW_MATERIAL = {
  id: 'm1',
  name: 'New Mat',
  unitOfMeasure: 'unit',
  categoryName: 'Cat',
};

describe('CreatePrivateMaterialModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getMaterialCategories.mockResolvedValue([{ id: 'c1', name: 'Cat' }]);
    mockApi.createMaterial.mockResolvedValue(NEW_MATERIAL);
  });

  it('renders title, subtitle and field labels', () => {
    renderWithClient(<CreatePrivateMaterialModal onClose={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByText('privateMaterial.title')).toBeInTheDocument();
    expect(screen.getByText('privateMaterial.subtitle')).toBeInTheDocument();
    expect(screen.getByText('privateMaterial.nameLabel')).toBeInTheDocument();
    expect(screen.getByText('privateMaterial.uomLabel')).toBeInTheDocument();
  });

  it('prefills name, uom and description from initial values', () => {
    renderWithClient(
      <CreatePrivateMaterialModal
        initialName="Seed Name"
        initialUom="kg"
        initialDescription="Seed desc"
        onClose={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    expect(screen.getByTestId<HTMLInputElement>('private-material-name').value).toBe('Seed Name');
    expect(screen.getByTestId<HTMLInputElement>('private-material-uom').value).toBe('kg');
    expect(screen.getByDisplayValue('Seed desc')).toBeInTheDocument();
  });

  it('loads categories into the dropdown', async () => {
    renderWithClient(<CreatePrivateMaterialModal onClose={vi.fn()} onCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Cat' })).toBeInTheDocument());
  });

  it('shows name-required error and does not call createMaterial when name is blank', () => {
    renderWithClient(<CreatePrivateMaterialModal onClose={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByTestId('private-material-submit'));
    expect(screen.getByText('privateMaterial.nameRequired')).toBeInTheDocument();
    expect(mockApi.createMaterial).not.toHaveBeenCalled();
  });

  it('shows uom-required error and does not call createMaterial when uom is blank', () => {
    renderWithClient(
      <CreatePrivateMaterialModal initialName="Has Name" onClose={vi.fn()} onCreated={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('private-material-submit'));
    expect(screen.getByText('privateMaterial.uomRequired')).toBeInTheDocument();
    expect(mockApi.createMaterial).not.toHaveBeenCalled();
  });

  it('submits successfully: calls createMaterial, notifies and calls onCreated', async () => {
    const onCreated = vi.fn();
    renderWithClient(
      <CreatePrivateMaterialModal
        initialName="Steel Bar"
        initialUom="unit"
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );
    fireEvent.click(screen.getByTestId('private-material-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(NEW_MATERIAL));
    expect(mockApi.createMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Steel Bar', unitOfMeasure: 'unit' }),
    );
    expect(mockNotify.success).toHaveBeenCalledWith('privateMaterial.created');
  });

  it('passes category and description through to createMaterial', async () => {
    const onCreated = vi.fn();
    renderWithClient(
      <CreatePrivateMaterialModal
        initialName="Bolt"
        initialUom="unit"
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );
    await waitFor(() => expect(screen.getByRole('option', { name: 'Cat' })).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'desc text' } });
    fireEvent.click(screen.getByTestId('private-material-submit'));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(mockApi.createMaterial).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'c1', description: 'desc text' }),
    );
  });

  it('shows the error message when createMaterial rejects', async () => {
    mockApi.createMaterial.mockRejectedValueOnce(new Error('boom'));
    const onCreated = vi.fn();
    renderWithClient(
      <CreatePrivateMaterialModal
        initialName="X"
        initialUom="unit"
        onClose={vi.fn()}
        onCreated={onCreated}
      />,
    );
    fireEvent.click(screen.getByTestId('private-material-submit'));
    await waitFor(() =>
      expect(screen.getByText('privateMaterial.createError')).toBeInTheDocument(),
    );
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('typing into name and uom updates the inputs', () => {
    renderWithClient(<CreatePrivateMaterialModal onClose={vi.fn()} onCreated={vi.fn()} />);
    const name = screen.getByTestId<HTMLInputElement>('private-material-name');
    const uom = screen.getByTestId<HTMLInputElement>('private-material-uom');
    fireEvent.change(name, { target: { value: 'Typed Name' } });
    fireEvent.change(uom, { target: { value: 'box' } });
    expect(name.value).toBe('Typed Name');
    expect(uom.value).toBe('box');
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    renderWithClient(<CreatePrivateMaterialModal onClose={onClose} onCreated={vi.fn()} />);
    fireEvent.click(screen.getByText('privateMaterial.cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
