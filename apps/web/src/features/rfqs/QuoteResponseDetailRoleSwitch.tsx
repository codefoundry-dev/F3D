import { UserRole } from '@forethread/shared-types/client';
import { lazy, Suspense } from 'react';
import { generatePath, Navigate, useParams } from 'react-router-dom';

import { RFQ_MESSAGES_HASH, ROUTES } from '@/app/route-config';
import { RoleSwitch } from '@/shared/role';

const BuyerQuoteResponseDetailPage = lazy(() => import('./buyer/pages/QuoteResponseDetailPage'));

/**
 * A vendor has no per-quote page — their side of the buyer↔vendor conversation
 * lives in the Messages section of their RFQ page. "New message" notifications
 * deep-link to this URL for both sides, so send the vendor there instead of to
 * the buyer-only review page (which used to bounce them to /forbidden).
 */
function VendorQuoteRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={`${generatePath(ROUTES.rfqDetail, { id: id ?? '' })}${RFQ_MESSAGES_HASH}`}
      replace
    />
  );
}

export default function QuoteResponseDetailRoleSwitch() {
  return (
    <Suspense fallback={null}>
      <RoleSwitch
        byRole={{
          [UserRole.COMPANY_ADMIN]: <BuyerQuoteResponseDetailPage />,
          [UserRole.PROCUREMENT_OFFICER]: <BuyerQuoteResponseDetailPage />,
          [UserRole.VENDOR]: <VendorQuoteRedirect />,
        }}
      />
    </Suspense>
  );
}
