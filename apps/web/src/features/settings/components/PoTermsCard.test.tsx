import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockToastSuccess = vi.fn();
vi.mock('@forethread/ui-components', () => ({
  Button: ({ children, isLoading: _isLoading, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  Textarea: (props: any) => <textarea {...props} />,
  toast: { success: (msg: string) => mockToastSuccess(msg) },
}));

const mockCompany = vi.hoisted(() => ({ value: undefined as unknown }));
const mockMutate = vi.fn();
vi.mock('@/features/companies/services/companies.service', () => ({
  useCompany: () => ({ data: mockCompany.value }),
  useUpdateCompany: () => ({ mutate: mockMutate, isPending: false }),
}));

import { PoTermsCard } from './PoTermsCard';

describe('PoTermsCard (FOR-398)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCompany.value = { id: 'company-1', poTermsAndConditions: 'Net 30' };
  });

  it('loads the saved default terms and keeps Save disabled until they change', () => {
    render(<PoTermsCard companyId="company-1" />);
    expect(screen.getByLabelText('poTermsCard.label')).toHaveValue('Net 30');
    expect(screen.getByRole('button', { name: 'poTermsCard.save' })).toBeDisabled();
  });

  it('saves the edited terms to the company and confirms', () => {
    mockMutate.mockImplementation((_vars, opts) => opts.onSuccess());
    render(<PoTermsCard companyId="company-1" />);

    fireEvent.change(screen.getByLabelText('poTermsCard.label'), {
      target: { value: 'Net 45' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'poTermsCard.save' }));

    expect(mockMutate).toHaveBeenCalledWith(
      { id: 'company-1', dto: { poTermsAndConditions: 'Net 45' } },
      expect.any(Object),
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('poTermsCard.saved');
  });

  it('starts empty when the company has no default terms', () => {
    mockCompany.value = { id: 'company-1', poTermsAndConditions: null };
    render(<PoTermsCard companyId="company-1" />);
    expect(screen.getByLabelText('poTermsCard.label')).toHaveValue('');
  });
});
