import type { InvoicePendingItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DashboardSection, DashboardSectionSkeleton, InvoiceCard } from '@forethread/ui-components';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface DisputedInvoicesSectionProps {
  items: InvoicePendingItem[];
  isLoading?: boolean;
  className?: string;
}

function invoiceDetailPath(id: string): string {
  return ROUTES.invoiceDetail.replace(':id', id);
}

export function DisputedInvoicesSection({
  items,
  isLoading,
  className,
}: DisputedInvoicesSectionProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('finance.disputed.title')} />;
  }

  return (
    <DashboardSection title={t('finance.disputed.title')} className={className}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('finance.disputed.noInvoices')}
        </p>
      ) : (
        items.map((item) => (
          <InvoiceCard
            key={item.id}
            name={item.vendorName ?? '—'}
            item={item}
            onCardClick={() => void navigate(invoiceDetailPath(item.id))}
            onMessageClick={() => void navigate(`${invoiceDetailPath(item.id)}?tab=messages`)}
            onAttachmentClick={() => void navigate(`${invoiceDetailPath(item.id)}?tab=attachments`)}
          />
        ))
      )}
    </DashboardSection>
  );
}
