import { type VendorActivePo, exportPurchaseOrders } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { DotActionsMenu, MessageBadgeIcon } from '@forethread/ui-components';
import EyeIcon from '@forethread/ui-components/assets/icons/eye-opened.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { ACTION_BUTTON_CLASS } from './constants';
import type { ColumnConfig } from './types';

interface ActivePosRowProps {
  row: VendorActivePo;
  columns: ColumnConfig[];
}

export function ActivePosRow({ row, columns }: ActivePosRowProps) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();

  const navigateToDetail = useCallback(
    () => navigate(ROUTES.purchaseOrderDetail.replace(':id', row.id)),
    [navigate, row.id],
  );

  const dotActions = [
    { key: 'view', label: t('actions.view'), onClick: navigateToDetail },
    {
      key: 'downloadPdf',
      label: t('actions.downloadPdf'),
      onClick: () => {
        void exportPurchaseOrders('pdf', { search: row.id }).then(({ url }) =>
          window.open(url, '_blank'),
        );
      },
    },
  ];

  const detailUrl = ROUTES.purchaseOrderDetail.replace(':id', row.id);

  const stopAndGo = (e: React.MouseEvent, tab?: string) => {
    e.stopPropagation();
    navigate(tab ? `${detailUrl}?tab=${tab}` : detailUrl);
  };

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      {columns.map((col) => (
        <td key={col.key} className="px-4 py-3 text-foreground whitespace-nowrap">
          {col.cell ? col.cell(row) : String(row[col.field] ?? '-')}
        </td>
      ))}
      <td className="px-4 py-3" style={{ width: 120, maxWidth: 120 }}>
        <div className="flex items-center gap-2 justify-center">
          <button
            type="button"
            title="Messages"
            onClick={(e) => stopAndGo(e, 'purchaseOrders')}
            className={ACTION_BUTTON_CLASS}
          >
            <MessageBadgeIcon hasNotification className="text-muted-foreground" />
          </button>
          <button
            type="button"
            title="Attachments"
            onClick={(e) => stopAndGo(e, 'documents')}
            className={ACTION_BUTTON_CLASS}
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="View"
            onClick={(e) => stopAndGo(e)}
            className={ACTION_BUTTON_CLASS}
          >
            <EyeIcon className="w-4 h-4" />
          </button>
          <DotActionsMenu bordered={false} actions={dotActions} />
        </div>
      </td>
    </tr>
  );
}
