import { CompanyType } from '@forethread/shared-types/client';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/features/companies/services/companies.service', () => ({
  useCompanies: () => ({
    data: {
      items: [
        { id: 'c1', legalName: 'Company A' },
        { id: 'c2', legalName: 'Company B' },
      ],
    },
  }),
}));

vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, ...p }: any) => <button {...p}>{children}</button>,
  IconBadge: () => <div data-testid="icon-badge" />,
  ModalGridHeader: ({ title, subtitle }: any) => (
    <div data-testid="modal-grid-header">
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
    </div>
  ),
  CustomDropdown: ({ onChange, actionItem }: any) => {
    return (
      <div data-testid="dropdown">
        <button data-testid="dropdown-select-c1" onClick={() => onChange('c1')}>
          Select C1
        </button>
        <button data-testid="dropdown-select-c2" onClick={() => onChange('c2')}>
          Select C2
        </button>
        {actionItem && (
          <button data-testid="dropdown-action" onClick={actionItem.onClick}>
            {actionItem.label}
          </button>
        )}
      </div>
    );
  },
  RadioGroup: ({ options, onChange }: any) => {
    return (
      <div data-testid="radio-group">
        {options?.map((o: any) => (
          <button key={o.value} data-testid={`radio-${o.value}`} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    );
  },
  onPhoneOnly: vi.fn(),
  onDigitsOnly: vi.fn(),
  onDecimalOnly: vi.fn(),
}));

vi.mock('@forethread/ui-components/assets/icons/department.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/new-user.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));
vi.mock('@forethread/ui-components/assets/icons/plus-in-circle.svg?react', () => ({
  default: (p: any) => <svg {...p} />,
}));

import { CompanySelectionStep } from './CompanySelectionStep';

describe('CompanySelectionStep', () => {
  const defaultProps = {
    companyType: CompanyType.CONTRACTOR as const,
    companyId: null,
    onCompanyTypeChange: vi.fn(),
    onCompanyChange: vi.fn(),
    onContinue: vi.fn(),
    onCancel: vi.fn(),
    onAddCompany: vi.fn(),
  };

  it('renders the title and subtitle', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.title')).toBeInTheDocument();
    expect(screen.getByText('createUserPage.subtitle')).toBeInTheDocument();
  });

  it('renders company type radio group', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    expect(screen.getByTestId('radio-group')).toBeInTheDocument();
  });

  it('renders company dropdown when companyType is set', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
  });

  it('does not render company dropdown when companyType is null', () => {
    render(<CompanySelectionStep {...defaultProps} companyType={null} />);
    expect(screen.queryByTestId('dropdown')).not.toBeInTheDocument();
  });

  it('renders cancel and continue buttons', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.cancel')).toBeInTheDocument();
    expect(screen.getByText('createUserPage.continue')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    fireEvent.click(screen.getByText('createUserPage.cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onContinue when continue button is clicked', () => {
    render(<CompanySelectionStep {...defaultProps} companyId="c1" />);
    // Need to select a company first to enable the button
    fireEvent.click(screen.getByTestId('dropdown-select-c1'));
    fireEvent.click(screen.getByText('createUserPage.continue'));
    expect(defaultProps.onContinue).toHaveBeenCalled();
  });

  it('continue button is disabled when no company selected', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    expect(screen.getByText('createUserPage.continue')).toBeDisabled();
  });

  it('continue button is disabled when no company type selected', () => {
    render(<CompanySelectionStep {...defaultProps} companyType={null} />);
    expect(screen.getByText('createUserPage.continue')).toBeDisabled();
  });

  it('calls onCompanyTypeChange when radio option is clicked', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    fireEvent.click(screen.getByTestId('radio-VENDOR'));
    expect(defaultProps.onCompanyTypeChange).toHaveBeenCalledWith('VENDOR');
  });

  it('calls onCompanyChange when a company is selected from dropdown', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    fireEvent.click(screen.getByTestId('dropdown-select-c1'));
    expect(defaultProps.onCompanyChange).toHaveBeenCalledWith('c1', 'Company A');
  });

  it('calls onAddCompany when dropdown action item is clicked', () => {
    render(<CompanySelectionStep {...defaultProps} />);
    fireEvent.click(screen.getByTestId('dropdown-action'));
    expect(defaultProps.onAddCompany).toHaveBeenCalled();
  });

  it('shows vendor-specific add company label when type is Vendor', () => {
    render(<CompanySelectionStep {...defaultProps} companyType={CompanyType.VENDOR} />);
    expect(screen.getByTestId('dropdown-action')).toHaveTextContent(
      'createUserPage.addVendorCompany',
    );
  });

  it('shows contractor-specific add company label when type is Contractor', () => {
    render(<CompanySelectionStep {...defaultProps} companyType={CompanyType.CONTRACTOR} />);
    expect(screen.getByTestId('dropdown-action')).toHaveTextContent(
      'createUserPage.addContractorCompany',
    );
  });
});
