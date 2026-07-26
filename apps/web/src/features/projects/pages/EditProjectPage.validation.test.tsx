/**
 * Regression cover for the PATCH 400 "startDate must be a valid ISO 8601 date
 * string; expectedEndDate must be a valid ISO 8601 date string".
 *
 * A project saved without dates loads them into the form as `''`, and `??` does
 * not coerce `''` — so the blank strings were forwarded to an API that only
 * accepts an ISO date or `null`. Runs through the REAL zod resolver + schema so
 * a form/schema mismatch fails here rather than in the browser.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseProject = vi.hoisted(() => vi.fn());
const mockUseUpdateProject = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockNotify = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { fields?: string }) =>
      options?.fields ? `${key}:${options.fields}` : key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'proj-1' }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: any) => any) => selector({ setTitle: vi.fn() }),
}));

vi.mock('@forethread/api-client', () => ({ searchAddresses: vi.fn() }));

// Input/Textarea must forward refs — `register` returns a ref, and a field
// without a live DOM node reads back as undefined.
vi.mock('@forethread/ui-components', async () => {
  const { forwardRef } = await import('react');
  return {
    Input: forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
    AddressInput: (props: any) => (
      <input
        data-testid="address-input"
        value={props.value}
        onChange={(e: any) => props.onChange?.(e.target.value)}
      />
    ),
    Textarea: forwardRef((props: any, ref: any) => <textarea ref={ref} {...props} />),
    CustomDropdown: (props: any) => (
      <select value={props.value ?? ''} onChange={(e: any) => props.onChange?.(e.target.value)} />
    ),
    RadioButton: (props: any) => (
      <input type="radio" checked={props.checked} onChange={props.onChange} />
    ),
    FormField: ({ children, label, error }: any) => (
      <div>
        <label>{label}</label>
        {children}
        {error && <span data-testid="field-error">{error}</span>}
      </div>
    ),
    Button: (props: any) => (
      <button type={props.type} disabled={props.disabled} onClick={props.onClick}>
        {props.children}
      </button>
    ),
    Spinner: () => <div data-testid="spinner" />,
    Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
    DatePicker: (props: any) => (
      <input
        data-testid="date-picker"
        type="date"
        value={props.value ?? ''}
        onChange={(e: any) => props.onChange?.(e.target.value)}
      />
    ),
    buttonVariants: () => 'btn-class',
    onDecimalOnly: vi.fn(),
    notificationService: mockNotify,
  };
});

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('../services/projects.service', () => ({
  useProject: mockUseProject,
  useUpdateProject: mockUseUpdateProject,
}));

import EditProjectPage from './EditProjectPage';

/** A project saved without a budget, type, description or dates. */
const bareProject = {
  id: 'proj-1',
  name: 'Docklands Tower',
  description: null,
  type: null,
  status: 'PLANNED',
  plannedBudget: null,
  currency: 'AUD',
  startDate: null,
  expectedEndDate: null,
  locations: [
    { type: 'DELIVERY', address: '1 Collins St', label: null, isDefault: true },
    { type: 'STORAGE', address: '9 Depot Rd', label: null, isDefault: true },
  ],
};

const save = () => fireEvent.click(screen.getByText('edit.save'));

describe('EditProjectPage — real schema validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUpdateProject.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('sends null — never an empty string — for dates the project never had', async () => {
    mockUseProject.mockReturnValue({ data: bareProject, isLoading: false });
    render(<EditProjectPage />);

    save();

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    const payload = mockMutate.mock.calls[0][0];
    expect(payload.startDate).toBeNull();
    expect(payload.expectedEndDate).toBeNull();
    expect(payload.description).toBeNull();
    expect(payload.type).toBeNull();
    expect(payload.plannedBudget).toBeNull();
  });

  it('keeps dates the project already has', async () => {
    mockUseProject.mockReturnValue({
      data: {
        ...bareProject,
        startDate: '2026-01-15T00:00:00Z',
        expectedEndDate: '2026-06-15T00:00:00Z',
      },
      isLoading: false,
    });
    render(<EditProjectPage />);

    save();

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      startDate: '2026-01-15',
      expectedEndDate: '2026-06-15',
    });
  });

  it('clears a date the user wipes rather than silently keeping it', async () => {
    mockUseProject.mockReturnValue({
      data: { ...bareProject, startDate: '2026-01-15T00:00:00Z' },
      isLoading: false,
    });
    render(<EditProjectPage />);

    fireEvent.change(screen.getAllByTestId('date-picker')[0], { target: { value: '' } });
    save();

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0].startDate).toBeNull();
  });

  it('blocks the save and names the offending field when the name is cleared', async () => {
    mockUseProject.mockReturnValue({ data: bareProject, isLoading: false });
    render(<EditProjectPage />);

    fireEvent.change(screen.getByDisplayValue('Docklands Tower'), { target: { value: '' } });
    save();

    await waitFor(() => expect(mockNotify.error).toHaveBeenCalledTimes(1));
    expect(mockNotify.error.mock.calls[0][0]).toBe('create.validationToast:create.name');
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('blocks the save and names the section when an address is cleared', async () => {
    mockUseProject.mockReturnValue({ data: bareProject, isLoading: false });
    render(<EditProjectPage />);

    fireEvent.change(screen.getAllByTestId('address-input')[1], { target: { value: '' } });
    save();

    await waitFor(() => expect(mockNotify.error).toHaveBeenCalledTimes(1));
    expect(mockNotify.error.mock.calls[0][0]).toBe(
      'create.validationToast:create.storageLocations',
    );
    expect(mockMutate).not.toHaveBeenCalled();
  });
});
