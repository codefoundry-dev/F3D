import type { InvoicePendingItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  DashboardItemCard,
  DashboardSectionSkeleton,
  formatCurrency,
  formatDate,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import CartIcon from '@forethread/ui-components/assets/icons/cart.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface InvoicesPendingApprovalProps {
  items: InvoicePendingItem[];
  isLoading?: boolean;
}

const ICON = 'w-[18px] h-[18px]';

export function InvoicesPendingApproval({ items, isLoading }: InvoicesPendingApprovalProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('invoicesPendingApproval.title')} />;
  }

  return (
    <div className="bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col h-[420px]">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-base font-semibold text-foreground">
          {t('invoicesPendingApproval.title')}
        </h2>
      </div>
      <div className="px-4 pb-4 pt-0.5 flex-1 overflow-y-auto space-y-2">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('invoicesPendingApproval.noInvoices')}
          </p>
        ) : (
          items.map((item) => <PendingInvoiceCard key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function PendingInvoiceCard({ item }: { item: InvoicePendingItem }) {
  const navigate = useNavigate();

  // Per the frame, invoice cards carry no status badge and no inline actions —
  // approve/reject lives on the invoice detail page (reachable via the card).
  return (
    <DashboardItemCard
      name={item.vendorName}
      onCardClick={() => navigate(ROUTES.invoiceDetail.replace(':id', item.id))}
      hasChatNotification={item.hasUnreadMessages}
      hasAttachment={item.hasAttachments ?? false}
      onMessageClick={() =>
        navigate(`${ROUTES.invoiceDetail.replace(':id', item.id)}?tab=messages`)
      }
      onAttachmentClick={() =>
        navigate(`${ROUTES.invoiceDetail.replace(':id', item.id)}?tab=documents`)
      }
      fields={[
        { icon: <FileTextIcon className={ICON} />, value: item.invoiceId },
        { icon: <BriefcaseIcon className={ICON} />, value: item.projectName },
        { icon: <CartIcon className={ICON} />, value: item.poReference ?? '-' },
        { icon: <DateIcon className={ICON} />, value: formatDate(item.date) },
        {
          icon: <CoinsIcon className={ICON} />,
          value: formatCurrency(item.totalCost ?? 0),
        },
        {
          icon: <PackageIcon className={ICON} />,
          value: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`,
        },
      ]}
    />
  );
}
