import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';

import { RoleSwitch } from '@/shared/role';

const BuyerInvoiceDetailPage = lazy(() => import('./buyer/pages/InvoiceDetailPage'));
const FinanceInvoiceDetailPage = lazy(() => import('./finance/pages/InvoiceDetailPage'));
const VendorInvoiceDetailPage = lazy(() => import('./vendor/pages/InvoiceDetailPage'));

export default function InvoiceDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerInvoiceDetailPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerInvoiceDetailPage />,
          [UserRole.FINANCIAL_OFFICER]: <FinanceInvoiceDetailPage />,
          [UserRole.VENDOR]: <VendorInvoiceDetailPage />,
        }}
      />
    </Suspense>
  );
}
