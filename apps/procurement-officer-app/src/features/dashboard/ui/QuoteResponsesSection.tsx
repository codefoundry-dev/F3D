import { approveQuote, declineQuote } from '@forethread/api-client';
import type { QuoteResponseItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { QuoteResponseStatus } from '@forethread/shared-types/client';
import {
  Badge,
  DashboardItemCard,
  DashboardSectionSkeleton,
  formatCurrency,
  formatStatus,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import CrossInCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface QuoteResponsesSectionProps {
  items: QuoteResponseItem[];
  isLoading?: boolean;
}

type TabFilter = 'all' | 'pending' | 'acknowledged';

export function QuoteResponsesSection({ items, isLoading }: QuoteResponsesSectionProps) {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const approveMutation = useMutation({
    mutationFn: ({ rfqId, quoteId }: { rfqId: string; quoteId: string }) =>
      approveQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'po-ca'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: ({ rfqId, quoteId }: { rfqId: string; quoteId: string }) =>
      declineQuote(rfqId, quoteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'po-ca'] });
    },
  });

  const filteredItems =
    activeTab === 'all' ? items : items.filter((item) => item.status.toLowerCase() === activeTab);

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('quoteResponses.title')} />;
  }

  return (
    <div className="bg-white rounded-[14px] border border-black/20 overflow-hidden flex flex-col h-[420px]">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-lg font-medium text-foreground">{t('quoteResponses.title')}</h2>
        <div className="flex gap-1">
          {(['all', 'pending', 'acknowledged'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-muted text-foreground'
                  : 'border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(`quoteResponses.${tab}`)}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pb-4 pt-0.5 flex-1 overflow-auto space-y-2">
        {filteredItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('quoteResponses.noResponses')}
          </p>
        ) : (
          filteredItems.map((item) => {
            const isPending = item.status === (QuoteResponseStatus.PENDING as string);
            const isMutating =
              (approveMutation.isPending && approveMutation.variables?.quoteId === item.id) ||
              (declineMutation.isPending && declineMutation.variables?.quoteId === item.id);

            return (
              <DashboardItemCard
                key={item.id}
                name={item.vendorName}
                onCardClick={() =>
                  navigate(
                    `${ROUTES.quoteResponseDetail.replace(':id', item.rfqId).replace(':quoteId', item.id)}?tab=messages`,
                  )
                }
                hasChatNotification={item.hasUnreadMessages}
                hasAttachment={item.hasAttachments ?? false}
                onMessageClick={() =>
                  navigate(
                    `${ROUTES.quoteResponseDetail.replace(':id', item.rfqId).replace(':quoteId', item.id)}?tab=messages`,
                  )
                }
                onAttachmentClick={() =>
                  navigate(
                    `${ROUTES.quoteResponseDetail.replace(':id', item.rfqId).replace(':quoteId', item.id)}?tab=attachments`,
                  )
                }
                statusBadge={
                  <Badge className="bg-[#e4e4e4] text-[#262626] border-0 rounded-full text-xs px-2 py-0.5">
                    {formatStatus(item.status)}
                  </Badge>
                }
                actions={
                  isPending ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 h-8 px-3 py-2 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                        disabled={isMutating}
                        onClick={() =>
                          declineMutation.mutate({ rfqId: item.rfqId, quoteId: item.id })
                        }
                      >
                        <CrossInCircleIcon className="w-[18px] h-[18px]" />
                        {t('quoteResponses.decline')}
                      </button>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 h-8 px-3 py-2 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors disabled:opacity-50"
                        disabled={isMutating}
                        onClick={() =>
                          approveMutation.mutate({ rfqId: item.rfqId, quoteId: item.id })
                        }
                      >
                        <CheckCircleIcon className="w-[18px] h-[18px]" />
                        {t('quoteResponses.approve')}
                      </button>
                    </div>
                  ) : undefined
                }
                fields={[
                  { icon: <FileTextIcon className="w-[18px] h-[18px]" />, value: item.rfqNumber },
                  {
                    icon: <BriefcaseIcon className="w-[18px] h-[18px]" />,
                    value: item.projectName,
                  },
                  {
                    icon: <DateIcon className="w-[18px] h-[18px]" />,
                    value: item.dateRange ?? '-',
                  },
                  {
                    icon: <CoinsIcon className="w-[18px] h-[18px]" />,
                    value: formatCurrency(item.totalCost),
                  },
                  {
                    icon: <PackageIcon className="w-[18px] h-[18px]" />,
                    value: `${item.itemsCovered}/${item.totalItems} items`,
                  },
                ]}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
