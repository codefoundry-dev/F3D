import { InvoiceListPage } from '@forethread/invoice-shared';

export default function FinanceInvoiceListPage() {
  return <InvoiceListPage extraInvalidateKeys={[['dashboard', 'finance']]} />;
}
