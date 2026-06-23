import { getPurchaseOrders } from '@forethread/api-client';
import type { PoListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalGridBackground,
  ModalIconHeader,
  QueryContainer,
  SearchInput,
  formatDate,
} from '@forethread/ui-components';
import CartIcon from '@forethread/ui-components/assets/icons/cart.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

interface SelectPoModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen PO. The caller seeds the create form from it. */
  onSelect: (po: PoListItem) => void;
}

/**
 * Purchase-order picker for "Create new" / the dashboard quick action when there
 * is no PO context. Reuses the PO list endpoint; a flat searchable list (mirrors
 * the SelectRfqModal list view, minus the per-line drill-down).
 */
export function SelectPoModal({ open, onClose, onSelect }: SelectPoModalProps) {
  const { t } = useTranslation('deliveries');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', 'select-for-delivery'],
    queryFn: () => getPurchaseOrders({ limit: 50 }),
    enabled: open,
  });

  const pos = useMemo(() => data?.items ?? [], [data?.items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pos.filter(
      (po) =>
        po.projectName.toLowerCase().includes(q) ||
        (po.poNumber?.toLowerCase().includes(q) ?? false) ||
        po.id.toLowerCase().includes(q),
    );
  }, [pos, search]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} maxWidth="max-w-[640px]" decoration={<ModalGridBackground />}>
      <div className="relative p-8 max-h-[80vh] flex flex-col">
        <ModalIconHeader
          icon={<CartIcon className="w-6 h-6 text-foreground" />}
          title={t('create.selectPo')}
          subtitle={t('create.noPoHint')}
          onClose={onClose}
          className="mb-8"
        />

        <div className="rounded-xl border border-border p-4 flex-1 overflow-hidden flex flex-col">
          <SearchInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('list.searchPlaceholder')}
            className="mb-3"
          />

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-[356px]">
            <QueryContainer
              isLoading={isLoading}
              isEmpty={filtered.length === 0}
              emptyMessage={t('list.empty')}
            >
              {filtered.map((po) => (
                <div
                  key={po.id}
                  className="flex items-center gap-3 w-full rounded-lg border border-border p-3 hover:border-foreground/50 transition-colors cursor-pointer"
                  role="button"
                  tabIndex={0}
                  data-testid={`delivery-select-po-${po.id}`}
                  onClick={() => onSelect(po)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') onSelect(po);
                  }}
                >
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <PackageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-5">
                      {po.poNumber ?? po.id}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground leading-4">
                      <span className="truncate">{po.projectName}</span>
                      <span className="whitespace-nowrap">{formatDate(po.createdDate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </QueryContainer>
          </div>
        </div>
      </div>
    </Modal>
  );
}
