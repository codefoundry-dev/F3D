import type { VendorInvoiceItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DashboardSection, DashboardSectionSkeleton, InvoiceCard } from '@forethread/ui-components';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface InvoicesSectionProps {
  items: VendorInvoiceItem[];
  isLoading?: boolean;
}

export function InvoicesSection({ items, isLoading }: InvoicesSectionProps) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('vendor.invoices.title')} />;
  }

  return (
    <DashboardSection title={t('vendor.invoices.title')} maxHeight={420}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('vendor.invoices.noInvoices')}
        </p>
      ) : (
        items.map((item) => (
          <InvoiceCard
            key={item.id}
            name={item.companyName}
            item={item}
            onCardClick={() => navigate(ROUTES.invoiceDetail.replace(':id', item.id))}
          />
        ))
      )}
    </DashboardSection>
  );
}
