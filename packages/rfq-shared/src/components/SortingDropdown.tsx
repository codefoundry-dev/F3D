import { useTranslation } from '@forethread/i18n';
import { cn } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';

import { useDropdown } from '../hooks/useDropdown';

/** Sort orders offered on the review-quotes surfaces (US 5.06). */
export type QuoteSortOrder =
  | 'relevance'
  | 'priceAsc'
  | 'priceDesc'
  | 'deliveryEarliest'
  | 'deliveryLatest';

export const QUOTE_SORT_ORDERS: readonly QuoteSortOrder[] = [
  'relevance',
  'priceAsc',
  'priceDesc',
  'deliveryEarliest',
  'deliveryLatest',
];

const SORT_LABEL_KEYS: Record<QuoteSortOrder, string> = {
  relevance: 'responsesTab.sortRelevance',
  priceAsc: 'responsesTab.sortPriceAsc',
  priceDesc: 'responsesTab.sortPriceDesc',
  deliveryEarliest: 'responsesTab.sortDeliveryEarliest',
  deliveryLatest: 'responsesTab.sortDeliveryLatest',
};

interface SortingDropdownProps {
  value: QuoteSortOrder;
  onChange: (order: QuoteSortOrder) => void;
  className?: string;
}

/** "Sorting ∨" button with the Relevance / Price / Delivery menu (US 5.06). */
export function SortingDropdown({ value, onChange, className }: SortingDropdownProps) {
  const { t } = useTranslation('rfqs');
  const { isOpen, setIsOpen, ref } = useDropdown();

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-foreground border border-border rounded-xl hover:bg-accent transition-colors"
      >
        {t('responsesTab.sorting')}
        <ChevronDownIcon className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-50 p-2">
          {QUOTE_SORT_ORDERS.map((order) => (
            <button
              key={order}
              type="button"
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm rounded-lg hover:bg-accent transition-colors',
                order === value ? 'text-foreground font-medium' : 'text-card-foreground',
              )}
              onClick={() => {
                onChange(order);
                setIsOpen(false);
              }}
            >
              {t(SORT_LABEL_KEYS[order] as never)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
