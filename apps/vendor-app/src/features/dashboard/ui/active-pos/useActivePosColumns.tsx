import type { VendorActivePo } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Badge,
  formatStatus,
  getStatusColor,
  ORDER_STATUS_COLORS,
} from '@forethread/ui-components';
import { useMemo } from 'react';

import type { ColumnConfig } from './types';

export function useActivePosColumns(): ColumnConfig[] {
  const { t } = useTranslation(['dashboard', 'common']);

  return useMemo(
    () => [
      { key: 'poNumber', field: 'poNumber', label: t('vendor.activePOs.poNumber') },
      { key: 'projectName', field: 'projectName', label: t('vendor.activePOs.projectName') },
      { key: 'projectId', field: 'projectId', label: t('vendor.activePOs.projectId') },
      {
        key: 'contractorName',
        field: 'contractorName',
        label: t('vendor.activePOs.contractorName'),
      },
      {
        key: 'poStatus',
        field: 'poStatus',
        label: t('vendor.activePOs.poStatus'),
        cell: (row: VendorActivePo) => (
          <Badge className={getStatusColor(ORDER_STATUS_COLORS, row.poStatus)}>
            {formatStatus(row.poStatus)}
          </Badge>
        ),
      },
      {
        key: 'revision',
        field: 'revision',
        label: t('vendor.activePOs.revision'),
        cell: (row: VendorActivePo) => String(row.revision),
      },
      { key: 'poType', field: 'poType', label: t('vendor.activePOs.poType') },
      {
        key: 'pickUp',
        field: 'pickUp',
        label: t('vendor.activePOs.pickUp'),
        cell: (row: VendorActivePo) => (row.pickUp ? t('common:yes') : t('common:no')),
      },
    ],
    [t],
  );
}
