import { InvoiceListPage } from '@forethread/invoice-shared';

export default function FOInvoiceListPage() {
  return <InvoiceListPage extraInvalidateKeys={[['dashboard', 'finance']]} />;
}
