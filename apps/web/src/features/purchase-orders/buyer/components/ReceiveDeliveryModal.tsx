import { receivePurchaseOrder } from '@forethread/api-client';
import type { PoDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Modal,
  ModalGridBackground,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Button,
} from '@forethread/ui-components';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

interface ReceiveDeliveryModalProps {
  po: PoDetail;
  onClose: () => void;
  /** Called after a successful receipt so the caller can refresh its data. */
  onReceived?: () => void;
}

interface ReceiveRow {
  id: string;
  name: string;
  quantityOrdered: number;
  alreadyDelivered: number;
  /** The new cumulative delivered qty the user is entering (string for input). */
  value: string;
}

function isValidRow(row: ReceiveRow): boolean {
  const trimmed = row.value.trim();
  if (trimmed === '') return false;
  const num = Number(trimmed);
  if (!Number.isInteger(num)) return false;
  return num >= row.alreadyDelivered && num <= row.quantityOrdered;
}

/**
 * Week-3 — record a delivery/receipt against a PO. One row per line item; the
 * user enters the NEW cumulative delivered quantity per line (pre-filled with
 * the current delivered qty, bounded to [alreadyDelivered, ordered]). On submit
 * the PO advances to PARTIALLY_DELIVERED / DELIVERED server-side.
 */
export function ReceiveDeliveryModal({ po, onClose, onReceived }: ReceiveDeliveryModalProps) {
  const { t } = useTranslation('purchaseOrders');
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<ReceiveRow[]>(() =>
    (po.lineItems ?? []).map((li) => ({
      id: li.id,
      name: li.materialName ?? li.description ?? `#${li.lineNumber}`,
      quantityOrdered: li.quantityOrdered,
      alreadyDelivered: li.quantityDelivered,
      value: String(li.quantityDelivered),
    })),
  );

  const allValid = useMemo(() => rows.length > 0 && rows.every(isValidRow), [rows]);

  const mutation = useMutation({
    mutationFn: () =>
      receivePurchaseOrder(po.id, {
        lines: rows.map((r) => ({ lineItemId: r.id, quantityDelivered: Number(r.value) })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders', po.id] });
      void queryClient.invalidateQueries({ queryKey: ['po-action-log', po.id] });
      onReceived?.();
      onClose();
    },
  });

  const setRowValue = (id: string, value: string) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" decoration={<ModalGridBackground />}>
      <div className="relative flex flex-col min-h-0">
        <ModalHeader onClose={onClose}>{t('receive.title', 'Record delivery')}</ModalHeader>
        <ModalBody>
          <p className="text-sm text-muted-foreground mb-4">
            {t(
              'receive.description',
              'Enter the total quantity received so far for each line. The order is marked delivered once all lines are fully received.',
            )}
          </p>

          <div className="space-y-3">
            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 text-xs font-medium text-muted-foreground px-1">
              <div className="col-span-6">{t('receive.item', 'Item')}</div>
              <div className="col-span-2 text-right">{t('receive.ordered', 'Ordered')}</div>
              <div className="col-span-2 text-right">{t('receive.delivered', 'Delivered')}</div>
              <div className="col-span-2 text-right">{t('receive.receiving', 'Received')}</div>
            </div>

            {rows.map((row) => {
              const invalid = !isValidRow(row);
              return (
                <div key={row.id} className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-6 text-sm text-foreground truncate" title={row.name}>
                    {row.name}
                  </div>
                  <div className="col-span-2 text-right text-sm text-foreground">
                    {row.quantityOrdered}
                  </div>
                  <div className="col-span-2 text-right text-sm text-muted-foreground">
                    {row.alreadyDelivered}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={row.alreadyDelivered}
                      max={row.quantityOrdered}
                      step={1}
                      value={row.value}
                      aria-label={t(
                        'receive.receivedFor',
                        'Received quantity for {{name}}',
                      ).replace('{{name}}', row.name)}
                      aria-invalid={invalid}
                      onChange={(e) => setRowValue(row.id, e.target.value)}
                      className={invalid ? 'border-destructive' : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {!allValid && (
            <p className="text-xs text-destructive mt-3">
              {t(
                'receive.validation',
                'Each quantity must be a whole number between the delivered amount and the ordered amount.',
              )}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('receive.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            isLoading={mutation.isPending}
            disabled={!allValid}
          >
            {t('receive.confirm', 'Record delivery')}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
