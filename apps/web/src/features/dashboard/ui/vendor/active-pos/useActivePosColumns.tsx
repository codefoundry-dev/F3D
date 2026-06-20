import type { VendorActivePo } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Badge, formatStatus } from '@forethread/ui-components';
import { useMemo } from 'react';

import type { ColumnConfig } from './types';

// Uniform gray pill — the Figma frame renders PO status and Revision with the
// same neutral chip (severity is not colour-coded here). `--accent` (#e8eaed)
// is the tokenized match for the frame's #E8EAED / #2D3139.
const PILL_CLASS = 'bg-accent text-foreground border-0 rounded-full px-2 py-1 text-xs font-normal';

export function useActivePosColumns(): ColumnConfig[] {
  const { t } = useTranslation(['dashboard', 'common']);

  return useMemo(
    () => [
      { key: 'poNumber', field: 'poNumber', label: t('vendor.activePOs.poNumber') },
      { key: 'projectName', field: 'projectName', label: t('vendor.activePOs.projectName') },
      // "Project ID" column shows the human-readable code (PRJ-YYYY-NNN); the
      // key stays `projectId` so the column label is unchanged.
      { key: 'projectId', field: 'projectCode', label: t('vendor.activePOs.projectId') },
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
          <Badge className={PILL_CLASS}>{formatStatus(row.poStatus)}</Badge>
        ),
      },
      {
        key: 'revision',
        field: 'revision',
        label: t('vendor.activePOs.revision'),
        // Frame shows the revision *state* as an "Active" pill, not the raw
        // number; the DTO only carries `revision` (number).
        cell: () => <Badge className={PILL_CLASS}>{t('vendor.activePOs.revisionActive')}</Badge>,
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
