import type { VendorRfqItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  DashboardItemCard,
  DashboardSection,
  DashboardSectionSkeleton,
  formatCurrency,
} from '@forethread/ui-components';
import BriefcaseIcon from '@forethread/ui-components/assets/icons/briefcase.svg?react';
import CoinsIcon from '@forethread/ui-components/assets/icons/coins.svg?react';
import DateIcon from '@forethread/ui-components/assets/icons/date.svg?react';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import LetterIcon from '@forethread/ui-components/assets/icons/letter.svg?react';
import LocationIcon from '@forethread/ui-components/assets/icons/location.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

interface RfqsWaitingSectionProps {
  items: VendorRfqItem[];
  isLoading?: boolean;
}

export function RfqsWaitingSection({ items, isLoading }: RfqsWaitingSectionProps) {
  const { t } = useTranslation('dashboard');

  if (isLoading) {
    return <DashboardSectionSkeleton title={t('vendor.rfqsWaiting.title')} />;
  }

  return (
    <DashboardSection title={t('vendor.rfqsWaiting.title')} maxHeight={420}>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('vendor.rfqsWaiting.noRfqs')}
        </p>
      ) : (
        items.map((item) => <RfqCard key={item.id} item={item} />)
      )}
    </DashboardSection>
  );
}

function RfqCard({ item }: { item: VendorRfqItem }) {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  return (
    <DashboardItemCard
      name={item.companyName}
      hasChatNotification={item.hasUnreadMessages}
      hasAttachment={item.hasAttachments ?? false}
      onCardClick={() => navigate(ROUTES.rfqDetail.replace(':id', item.id))}
      actions={
        <button
          type="button"
          className="flex items-center gap-1.5 h-8 px-3 py-2 border border-black rounded-xl text-sm font-medium text-black hover:bg-black/5 transition-colors"
          onClick={() => navigate(ROUTES.rfqDetail.replace(':id', item.id))}
        >
          <LetterIcon className="w-[18px] h-[18px]" />
          {t('vendor.rfqsWaiting.response')}
        </button>
      }
      fields={[
        { icon: <FileTextIcon className="w-[18px] h-[18px]" />, value: item.rfqId },
        { icon: <BriefcaseIcon className="w-[18px] h-[18px]" />, value: item.projectName },
        { icon: <DateIcon className="w-[18px] h-[18px]" />, value: item.dateRange ?? '-' },
        {
          icon: <CoinsIcon className="w-[18px] h-[18px]" />,
          value: formatCurrency(item.totalCost),
        },
        {
          icon: <PackageIcon className="w-[18px] h-[18px]" />,
          value: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`,
        },
        {
          icon: <LocationIcon className="w-[18px] h-[18px]" />,
          value: item.deliveryLocation ?? '-',
        },
      ]}
    />
  );
}
