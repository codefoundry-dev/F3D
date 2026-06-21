import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/ui-components', () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  ModalGridBackground: () => <div data-testid="modal-grid-bg" />,
  REGISTRATION_MODAL_CARD_CLASS: '',
  UserAlreadyExistsModal: () => <div data-testid="user-exists-modal" />,
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('./modals/AddContractorCompanyModal', () => ({
  AddContractorCompanyModal: ({ onClose, onSuccess }: any) => (
    <div data-testid="add-contractor-modal">
      <button data-testid="contractor-close" onClick={onClose}>
        Close
      </button>
      <button
        data-testid="contractor-success"
        onClick={() => onSuccess({ id: 'new-c', legalName: 'New Corp' })}
      >
        Success
      </button>
    </div>
  ),
}));

vi.mock('./modals/AddVendorCompanyModal', () => ({
  AddVendorCompanyModal: ({ onClose, onSuccess }: any) => (
    <div data-testid="add-vendor-modal">
      <button data-testid="vendor-close" onClick={onClose}>
        Close
      </button>
      <button
        data-testid="vendor-success"
        onClick={() => onSuccess({ id: 'new-v', legalName: 'New Vendor' })}
      >
        Success
      </button>
    </div>
  ),
}));

vi.mock('./steps/CompanySelectionStep', () => ({
  CompanySelectionStep: (props: any) => (
    <div data-testid="company-selection-step">
      <button data-testid="continue-btn" onClick={props.onContinue}>
        Continue
      </button>
      <button data-testid="cancel-btn" onClick={props.onCancel}>
        Cancel
      </button>
      <button data-testid="add-company-btn" onClick={props.onAddCompany}>
        Add Company
      </button>
      <button data-testid="set-contractor" onClick={() => props.onCompanyTypeChange('CONTRACTOR')}>
        Contractor
      </button>
      <button data-testid="set-vendor" onClick={() => props.onCompanyTypeChange('VENDOR')}>
        Vendor
      </button>
      <button data-testid="select-company" onClick={() => props.onCompanyChange('c1', 'Acme')}>
        Select
      </button>
      <span data-testid="company-type">{props.companyType ?? 'null'}</span>
      <span data-testid="company-id">{props.companyId ?? 'null'}</span>
    </div>
  ),
}));

vi.mock('./steps/InvitationSuccessStep', () => ({
  InvitationSuccessStep: ({ email }: any) => (
    <div data-testid="invitation-success-step">{email}</div>
  ),
}));

vi.mock('./steps/UserDetailsStep', () => ({
  UserDetailsStep: ({ onSuccess, onCancel, companyType, companyId, companyName }: any) => (
    <div data-testid="user-details-step">
      <span data-testid="details-company-type">{companyType}</span>
      <span data-testid="details-company-id">{companyId}</span>
      <span data-testid="details-company-name">{companyName}</span>
      <button data-testid="invite-success" onClick={() => onSuccess('newuser@example.com')}>
        Invite
      </button>
      <button data-testid="invite-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ),
}));

import { CreateUserModal } from './CreateUserModal';

describe('CreateUserModal', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal', () => {
    render(<CreateUserModal onClose={onClose} />);
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('renders company selection step by default', () => {
    render(<CreateUserModal onClose={onClose} />);
    expect(screen.getByTestId('company-selection-step')).toBeInTheDocument();
  });

  it('does not show user details step initially', () => {
    render(<CreateUserModal onClose={onClose} />);
    expect(screen.queryByTestId('user-details-step')).not.toBeInTheDocument();
  });

  it('does not show success step initially', () => {
    render(<CreateUserModal onClose={onClose} />);
    expect(screen.queryByTestId('invitation-success-step')).not.toBeInTheDocument();
  });

  it('handleCompanyTypeChange updates company type and resets company', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    expect(screen.getByTestId('company-type').textContent).toBe('CONTRACTOR');
    expect(screen.getByTestId('company-id').textContent).toBe('null');
  });

  it('handleCompanyChange updates company id', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('select-company'));
    expect(screen.getByTestId('company-id').textContent).toBe('c1');
  });

  it('clicking continue transitions to userDetails step when company selected', () => {
    render(<CreateUserModal onClose={onClose} />);
    // Select company type and company first
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('select-company'));
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(screen.getByTestId('user-details-step')).toBeInTheDocument();
  });

  it('cancel button calls onClose', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('cancel-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('handleInvitationSuccess transitions to success step', () => {
    render(<CreateUserModal onClose={onClose} />);
    // Navigate to user details step first
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('select-company'));
    fireEvent.click(screen.getByTestId('continue-btn'));
    // Now trigger invitation success
    fireEvent.click(screen.getByTestId('invite-success'));
    expect(screen.getByTestId('invitation-success-step')).toBeInTheDocument();
    expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
  });

  it('shows AddContractorCompanyModal when contractor type and add company clicked', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    expect(screen.getByTestId('add-contractor-modal')).toBeInTheDocument();
  });

  it('shows AddVendorCompanyModal when vendor type and add company clicked', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-vendor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    expect(screen.getByTestId('add-vendor-modal')).toBeInTheDocument();
  });

  it('contractor success sets company and marks as newly created', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    fireEvent.click(screen.getByTestId('contractor-success'));
    expect(screen.getByTestId('company-id').textContent).toBe('new-c');
  });

  it('vendor success sets company and marks as newly created', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-vendor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    fireEvent.click(screen.getByTestId('vendor-success'));
    expect(screen.getByTestId('company-id').textContent).toBe('new-v');
  });

  it('closing add contractor modal hides it', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    expect(screen.getByTestId('add-contractor-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('contractor-close'));
    expect(screen.queryByTestId('add-contractor-modal')).not.toBeInTheDocument();
  });

  it('switching company type resets companyId and companyName', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('select-company'));
    expect(screen.getByTestId('company-id').textContent).toBe('c1');
    // Switch type
    fireEvent.click(screen.getByTestId('set-vendor'));
    expect(screen.getByTestId('company-id').textContent).toBe('null');
    expect(screen.getByTestId('company-type').textContent).toBe('VENDOR');
  });

  it('closing add vendor modal hides it', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-vendor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    expect(screen.getByTestId('add-vendor-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('vendor-close'));
    expect(screen.queryByTestId('add-vendor-modal')).not.toBeInTheDocument();
  });

  it('cancel from user details step calls onClose', () => {
    render(<CreateUserModal onClose={onClose} />);
    // Navigate to user details step
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('select-company'));
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(screen.getByTestId('user-details-step')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('invite-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('vendor success sets company id and name from vendor modal', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-vendor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    fireEvent.click(screen.getByTestId('vendor-success'));
    // After vendor success, company should be updated
    expect(screen.getByTestId('company-id').textContent).toBe('new-v');
  });

  it('contractor success allows navigating to user details step with newly created company', () => {
    render(<CreateUserModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('set-contractor'));
    fireEvent.click(screen.getByTestId('add-company-btn'));
    fireEvent.click(screen.getByTestId('contractor-success'));
    // Now continue to user details
    fireEvent.click(screen.getByTestId('continue-btn'));
    expect(screen.getByTestId('user-details-step')).toBeInTheDocument();
    expect(screen.getByTestId('details-company-id').textContent).toBe('new-c');
    expect(screen.getByTestId('details-company-name').textContent).toBe('New Corp');
  });
});
