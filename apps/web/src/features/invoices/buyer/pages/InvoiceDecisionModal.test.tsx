import { InvoiceDecisionModal } from '@forethread/invoice-shared';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@forethread/api-client', () => ({
  // Pulled in by the invoice-shared barrel; the modal itself calls none of it.
  getMe: vi.fn(),
  getCompanyVendors: vi.fn(),
  getProjects: vi.fn(),
  getPurchaseOrders: vi.fn(),
  getInvoicePoMatch: vi.fn(),
  reviewInvoice: vi.fn(),
  getInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getInvoiceAuditTrail: vi.fn(),
  getInvoiceIntakeAddress: vi.fn(),
  approveInvoice: vi.fn(),
  rejectInvoice: vi.fn(),
  bulkApproveInvoices: vi.fn(),
  exportInvoices: vi.fn(),
  exportSingleInvoice: vi.fn(),
  uploadInvoice: vi.fn(),
  openFileInNewTab: vi.fn(),
  downloadFile: vi.fn(),
}));

vi.mock('@forethread/i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const template = options?.defaultValue ?? _key;
      return template.replace(/\{\{(\w+)\}\}/gu, (_, name: string) =>
        String((options?.[name] as string | number | undefined) ?? ''),
      );
    },
  }),
}));

describe('InvoiceDecisionModal', () => {
  it('approve mode confirms without a note (reason optional)', () => {
    const onConfirm = vi.fn();
    render(
      <InvoiceDecisionModal
        mode="approve"
        isPending={false}
        isError={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByTestId('invoice-decision-confirm');
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('approve mode passes the trimmed note through', () => {
    const onConfirm = vi.fn();
    render(
      <InvoiceDecisionModal
        mode="approve"
        isPending={false}
        isError={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByTestId('invoice-decision-reason'), {
      target: { value: '  Verified against the PO.  ' },
    });
    fireEvent.click(screen.getByTestId('invoice-decision-confirm'));
    expect(onConfirm).toHaveBeenCalledWith('Verified against the PO.');
  });

  it('decline mode requires a reason before confirming', () => {
    const onConfirm = vi.fn();
    render(
      <InvoiceDecisionModal
        mode="decline"
        isPending={false}
        isError={false}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    const confirm = screen.getByTestId('invoice-decision-confirm');
    expect(confirm).toBeDisabled();

    // Whitespace alone does not count as a reason.
    fireEvent.change(screen.getByTestId('invoice-decision-reason'), {
      target: { value: '   ' },
    });
    expect(screen.getByTestId('invoice-decision-confirm')).toBeDisabled();

    fireEvent.change(screen.getByTestId('invoice-decision-reason'), {
      target: { value: 'Quantities do not match the delivery note.' },
    });
    const enabled = screen.getByTestId('invoice-decision-confirm');
    expect(enabled).toBeEnabled();
    fireEvent.click(enabled);
    expect(onConfirm).toHaveBeenCalledWith('Quantities do not match the delivery note.');
  });

  it('shows the error alert when the mutation failed', () => {
    render(
      <InvoiceDecisionModal
        mode="decline"
        isPending={false}
        isError
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});
