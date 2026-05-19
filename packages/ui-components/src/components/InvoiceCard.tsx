import type { ReactNode } from 'react';

import BriefcaseIcon from '../assets/icons/briefcase.svg?react';
import CartIcon from '../assets/icons/cart.svg?react';
import CoinsIcon from '../assets/icons/coins.svg?react';
import DateIcon from '../assets/icons/date.svg?react';
import FileTextIcon from '../assets/icons/file-text.svg?react';
import PackageIcon from '../assets/icons/package.svg?react';
import { formatCurrency, formatDate, formatStatus } from '../utils/formatters';

import { Badge } from './Badge';
import { DashboardItemCard } from './DashboardItemCard';

export interface InvoiceCardItem {
  id: string;
  invoiceId: string;
  projectName: string;
  poReference: string | null;
  date: string;
  totalCost: number | null;
  itemCount: number;
  status: string;
  hasUnreadMessages?: boolean;
  hasAttachments?: boolean;
}

export interface InvoiceCardProps {
  /** Display name (vendor name, company name, etc.) */
  name: string;
  /** Invoice item data */
  item: InvoiceCardItem;
  /** Callback when the card body is clicked */
  onCardClick?: () => void;
  /** Callback when the message icon is clicked */
  onMessageClick?: () => void;
  /** Callback when the attachment icon is clicked */
  onAttachmentClick?: () => void;
  /** Action buttons (e.g. approve/reject) */
  actions?: ReactNode;
}

const ICON_CLASS = 'w-[18px] h-[18px]';

export function InvoiceCard({
  name,
  item,
  onCardClick,
  onMessageClick,
  onAttachmentClick,
  actions,
}: InvoiceCardProps) {
  return (
    <DashboardItemCard
      name={name}
      hasChatNotification={item.hasUnreadMessages}
      hasAttachment={item.hasAttachments ?? false}
      onCardClick={onCardClick}
      onMessageClick={onMessageClick}
      onAttachmentClick={onAttachmentClick}
      statusBadge={
        <Badge className="bg-muted text-foreground border-0 rounded-full text-xs px-2 py-0.5">
          {formatStatus(item.status)}
        </Badge>
      }
      actions={actions}
      fields={[
        { icon: <FileTextIcon className={ICON_CLASS} />, value: item.invoiceId },
        { icon: <BriefcaseIcon className={ICON_CLASS} />, value: item.projectName },
        { icon: <CartIcon className={ICON_CLASS} />, value: item.poReference ?? '-' },
        { icon: <DateIcon className={ICON_CLASS} />, value: formatDate(item.date) },
        {
          icon: <CoinsIcon className={ICON_CLASS} />,
          value: formatCurrency(item.totalCost ?? 0),
        },
        {
          icon: <PackageIcon className={ICON_CLASS} />,
          value: `${item.itemCount} ${item.itemCount === 1 ? 'item' : 'items'}`,
        },
      ]}
    />
  );
}
