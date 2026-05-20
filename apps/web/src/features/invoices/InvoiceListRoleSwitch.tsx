import { UserRole } from '@forethread/shared-types';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerInvoiceListPage = lazy(() => import('./buyer/pages/InvoiceListPage'));
const FinanceInvoiceListPage = lazy(() => import('./finance/pages/InvoiceListPage'));

export default function InvoiceListRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerInvoiceListPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerInvoiceListPage />,
          [UserRole.FINANCIAL_OFFICER]: <FinanceInvoiceListPage />,
        }}
      />
    </Suspense>
  );
}
