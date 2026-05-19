import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Button,
  Spinner,
  Alert,
  Input,
  Checkbox,
  notificationService,
  onDigitsOnly,
} from '@forethread/ui-components';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { useBulkOrder, useCreateDrawdown } from '../services/bulk-orders.service';

export function DrawdownPage() {
  const { t } = useTranslation('bulkOrders');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBulkOrder(id ?? '');
  const createDrawdown = useCreateDrawdown();
  const setTitle = usePageTitleStore((s) => s.setTitle);

  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data) setTitle(data.bulkId, t('list.subtitle') as string);
    return () => setTitle(null);
  }, [data, setTitle, t]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8">
        <Alert variant="destructive">{t('list.failedToLoad')}</Alert>
      </div>
    );
  }

  const availableItems = data.lineItems.filter((li) => li.qtyRemaining > 0);

  const toggleItem = (lineItemId: string) => {
    setSelectedItems((prev) => {
      const next = { ...prev, [lineItemId]: !prev[lineItemId] };
      if (!next[lineItemId]) {
        // Clear quantity and error when deselected
        setQuantities((q) => {
          const copy = { ...q };
          delete copy[lineItemId];
          return copy;
        });
        setErrors((e) => {
          const copy = { ...e };
          delete copy[lineItemId];
          return copy;
        });
      }
      return next;
    });
  };

  const setQuantity = (lineItemId: string, value: number, max: number) => {
    setQuantities((prev) => ({ ...prev, [lineItemId]: value }));
    if (value <= 0) {
      setErrors((prev) => ({ ...prev, [lineItemId]: 'Quantity must be greater than 0' }));
    } else if (value > max) {
      setErrors((prev) => ({
        ...prev,
        [lineItemId]: `Cannot exceed remaining quantity (${max})`,
      }));
    } else {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[lineItemId];
        return copy;
      });
    }
  };

  const selectedCount = Object.values(selectedItems).filter(Boolean).length;
  const hasErrors = Object.keys(errors).length > 0;
  const hasSelection = selectedCount > 0;
  const allHaveQuantities = Object.entries(selectedItems)
    .filter(([, selected]) => selected)
    .every(([itemId]) => quantities[itemId] && quantities[itemId] > 0);

  const canSubmit = hasSelection && allHaveQuantities && !hasErrors && !createDrawdown.isPending;

  const handleSubmit = async () => {
    const itemsToProcess = Object.entries(selectedItems)
      .filter(([, selected]) => selected)
      .map(([lineItemId]) => ({ lineItemId, quantity: quantities[lineItemId] }));

    try {
      for (const item of itemsToProcess) {
        await createDrawdown.mutateAsync({
          bulkOrderId: id!,
          payload: {
            lineItemId: item.lineItemId,
            quantity: item.quantity,
          },
        });
      }
      notificationService.success(t('modals.drawdownSuccess'));
      navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!));
    } catch {
      notificationService.error(t('modals.drawdownError'));
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-foreground mb-2">{t('modals.drawdownTitle')}</h1>
      <p className="text-sm text-muted-foreground mb-6">{t('modals.drawdownSubtitle')}</p>

      {/* Bulk order info */}
      <div className="rounded-lg border border-border bg-card p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{t('detail.bulkId')}</span>
            <p className="font-medium text-foreground">{data.bulkId}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.projectName')}</span>
            <p className="font-medium text-foreground">{data.projectName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.vendorName')}</span>
            <p className="font-medium text-foreground">{data.vendorName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('detail.createdBy')}</span>
            <p className="font-medium text-foreground">{data.createdBy}</p>
          </div>
        </div>
      </div>

      {/* Line items selection */}
      <div className="rounded-lg border border-border bg-card p-4 mb-6">
        <h2 className="text-base font-bold text-foreground mb-4">{t('modals.lineItemsSection')}</h2>

        {availableItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('list.noBulkOrdersFound')}</p>
        ) : (
          <div className="space-y-3">
            {availableItems.map((item) => (
              <div
                key={item.lineItemId}
                className="flex items-start gap-3 rounded-lg border border-border p-3"
              >
                <Checkbox
                  checked={selectedItems[item.lineItemId] ?? false}
                  onChange={() => toggleItem(item.lineItemId)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-foreground">
                      {item.itemReference}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('detail.qty')}: {item.qty}
                    </span>
                    <span>
                      {t('detail.ordered')}: {item.ordered}
                    </span>
                    <span className="font-medium">
                      {t('modals.remainingQty', { qty: item.qtyRemaining })}
                    </span>
                  </div>
                  {selectedItems[item.lineItemId] && (
                    <div className="mt-2 max-w-[200px]">
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onKeyDown={onDigitsOnly}
                        placeholder={t('modals.quantityLabel')}
                        value={quantities[item.lineItemId] ?? ''}
                        onChange={(e) =>
                          setQuantity(item.lineItemId, Number(e.target.value), item.qtyRemaining)
                        }
                      />
                      {errors[item.lineItemId] && (
                        <p className="text-xs text-destructive mt-1">{errors[item.lineItemId]}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="md" disabled={!canSubmit} onClick={handleSubmit}>
          {createDrawdown.isPending ? t('modals.creatingDrawdown') : t('modals.createDrawdown')}
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={() => navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!))}
        >
          {t('modals.cancel')}
        </Button>
      </div>
    </div>
  );
}
