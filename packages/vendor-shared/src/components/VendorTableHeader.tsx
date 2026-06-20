import { useTranslation } from '@forethread/i18n';
import { SortIcon } from '@forethread/ui-components';

import type { SortField, SortDir } from '../constants';

interface VendorTableHeaderProps {
  sortField: SortField | null;
  sortDir: SortDir | null;
  onSort: (field: SortField) => void;
}

export function VendorTableHeader({ sortField, sortDir, onSort }: VendorTableHeaderProps) {
  const { t } = useTranslation('vendors');

  const thBase = 'px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px]';
  const thSortable = `${thBase} cursor-pointer select-none transition-colors`;

  return (
    <thead>
      <tr className="border-b border-border bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
        <th
          className={`px-6 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px] ${thSortable}`}
          onClick={() => onSort('companyName')}
        >
          <span className="flex items-center justify-between w-full">
            {t('columns.fullName')}
            <SortIcon
              active={sortField === 'companyName'}
              direction={sortField === 'companyName' ? sortDir : null}
            />
          </span>
        </th>
        <th className={thSortable} onClick={() => onSort('email')}>
          <span className="flex items-center justify-between w-full">
            {t('columns.email')}
            <SortIcon
              active={sortField === 'email'}
              direction={sortField === 'email' ? sortDir : null}
            />
          </span>
        </th>
        <th className={thBase}>{t('columns.phoneNumber')}</th>
        <th className={thSortable} onClick={() => onSort('status')}>
          <span className="flex items-center justify-between w-full">
            {t('columns.status')}
            <SortIcon
              active={sortField === 'status'}
              direction={sortField === 'status' ? sortDir : null}
            />
          </span>
        </th>
        <th className={thSortable} onClick={() => onSort('assignedAt')}>
          <span className="flex items-center justify-between w-full">
            {t('columns.dateJoined')}
            <SortIcon
              active={sortField === 'assignedAt'}
              direction={sortField === 'assignedAt' ? sortDir : null}
            />
          </span>
        </th>
        <th className="w-[120px] px-4 py-3 text-left text-xs font-bold leading-4 tracking-[0.6px]">
          {t('columns.actions')}
        </th>
      </tr>
    </thead>
  );
}
