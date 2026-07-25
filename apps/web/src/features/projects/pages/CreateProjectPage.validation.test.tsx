/**
 * Regression cover for the "Create project does nothing" bug: step 3 submitted
 * through the REAL zod resolver + schema (the sibling spec stubs both out), so
 * a schema/form mismatch that silently aborts handleSubmit fails here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseCompanyUsers = vi.hoisted(() => vi.fn());
const mockUseCreateProject = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetPageTitle = vi.hoisted(() => vi.fn());

const USER = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Bob Builder',
  email: 'bob@x.com',
  avatarUrl: null,
  workStatus: null,
};

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@forethread/rfq-shared', () => ({
  usePageTitleStore: (selector: (s: any) => any) => selector({ setTitle: mockSetPageTitle }),
}));

vi.mock('@forethread/po-shared', () => ({
  Stepper: ({ step }: any) => <div data-testid="stepper">step-{step}</div>,
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

vi.mock('@forethread/api-client', () => ({ searchAddresses: vi.fn() }));

// Input/Textarea must forward refs — react-hook-form's `register` returns a ref
// and a field without a live DOM node reads back as `undefined`.
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
      <select value={props.value} onChange={(e: any) => props.onChange?.(e.target.value)} />
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
    Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
    AvatarWithStatus: ({ name }: any) => <span title={name} />,
    DatePicker: (props: any) => (
      <input
        type="date"
        value={props.value ?? ''}
        onChange={(e: any) => props.onChange?.(e.target.value)}
      />
    ),
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    onDecimalOnly: vi.fn(),
  };
});

vi.mock('@forethread/ui-components/assets/icons/delete.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/flag.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/info.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/paperclip.svg?react', () => ({
  default: () => <div />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus.svg?react', () => ({
  default: () => <div />,
}));

vi.mock('@/features/auth/state/auth.store', () => ({
  useAuthStore: (selector: (s: any) => any) =>
    selector({ currentUser: { ...USER, role: 'COMPANY_ADMIN', companyId: 'c1' } }),
}));

vi.mock('../services/projects.service', () => ({
  useCreateProject: mockUseCreateProject,
  useCompanyUsers: mockUseCompanyUsers,
}));

import CreateProjectPage from './CreateProjectPage';

/** Fill step 1 with the minimum the schema demands, then advance to step 3. */
async function completeWizard() {
  fireEvent.change(screen.getByPlaceholderText('create.namePlaceholder'), {
    target: { value: 'Docklands Tower' },
  });

  const [delivery, storage] = screen.getAllByTestId('address-input');
  fireEvent.change(delivery, { target: { value: '1 Collins St, Melbourne' } });
  fireEvent.change(storage, { target: { value: '9 Depot Rd, Laverton' } });

  fireEvent.change(screen.getByPlaceholderText('create.searchUsers'), {
    target: { value: 'Bob' },
  });
  fireEvent.click(screen.getByText(USER.email));

  fireEvent.click(screen.getByText('create.continue'));
  await screen.findByText('create.step2Heading');
  fireEvent.click(screen.getByText('create.continue'));
  await screen.findByText('create.step3Heading');
}

describe('CreateProjectPage — real schema validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateProject.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      isError: false,
      error: null,
    });
    mockUseCompanyUsers.mockReturnValue({ data: [USER] });
  });

  it('submits when the optional planned budget is left empty', async () => {
    render(<CreateProjectPage />);
    await completeWizard();

    fireEvent.click(screen.getByText('create.createProject'));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0]).toMatchObject({
      name: 'Docklands Tower',
      assignedUserIds: [USER.id],
    });
    // Omitted, not NaN — NaN is what silently blocked the wizard.
    expect(mockMutate.mock.calls[0][0].plannedBudget).toBeUndefined();
  });

  it('submits the planned budget as a number when filled', async () => {
    render(<CreateProjectPage />);
    await completeWizard();

    // Back to step 2 via the second review card's Edit link.
    fireEvent.click(screen.getAllByText('create.editLink')[1]);
    await screen.findByText('create.step2Heading');
    fireEvent.change(screen.getByPlaceholderText('create.budgetPlaceholder'), {
      target: { value: '25000.5' },
    });
    fireEvent.click(screen.getByText('create.continue'));
    await screen.findByText('create.step3Heading');

    fireEvent.click(screen.getByText('create.createProject'));

    await waitFor(() => expect(mockMutate).toHaveBeenCalledTimes(1));
    expect(mockMutate.mock.calls[0][0].plannedBudget).toBe(25000.5);
  });
});
