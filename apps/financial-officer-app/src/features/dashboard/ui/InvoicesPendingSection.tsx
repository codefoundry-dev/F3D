import { approveInvoice, rejectInvoice, type InvoicePendingItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DashboardSection, DashboardSectionSkeleton, InvoiceCard } from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import { invoiceDetailPath } from '@/app/route-config';

interface InvoicesPendingSectionProps {
  items: InvoicePendingItem[];
  isLoading?: boolean;
  className?: string;
}

export function InvoicesPendingSection({
  items,
  isLoading,
  className,
}: InvoicesPendingSectionProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('finance.invoicesPending.title')} />;
  }

  return (
    <DashboardSection title={t('finance.invoicesPending.title')} className={className}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('finance.invoicesPending.noInvoices')}
        </p>
      ) : (
        items.map((item) => <PendingInvoiceCard key={item.id} item={item} />)
      )}
    </DashboardSection>
  );
}

function PendingInvoiceCard({ item }: { item: InvoicePendingItem }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: () => approveInvoice(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'finance'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectInvoice(item.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'finance'] });
    },
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <InvoiceCard
      name={item.vendorName}
      item={item}
      onCardClick={() => navigate(invoiceDetailPath(item.id))}
      onMessageClick={() => navigate(`${invoiceDetailPath(item.id)}?tab=messages`)}
      onAttachmentClick={() => navigate(`${invoiceDetailPath(item.id)}?tab=attachments`)}
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1.5 h-8 px-3 py-2 border border-foreground rounded-xl text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
            disabled={isMutating}
            onClick={() => rejectMutation.mutate()}
          >
            <CrossInCircleIcon className="w-[18px] h-[18px]" />
            {t('invoicesPendingApproval.reject')}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 h-8 px-3 py-2 border border-foreground rounded-xl text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50"
            disabled={isMutating}
            onClick={() => approveMutation.mutate()}
          >
            <CheckCircleIcon className="w-[18px] h-[18px]" />
            {t('invoicesPendingApproval.approve')}
          </button>
        </div>
      }
    />
  );
}
