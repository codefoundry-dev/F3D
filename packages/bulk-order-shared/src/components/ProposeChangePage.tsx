import type { BulkOrderLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePageTitleStore } from '@forethread/rfq-shared';
import {
  Button,
  Spinner,
  Alert,
  Input,
  FormField,
  DatePicker,
  SelectDropdown,
  MessageBadgeIcon,
  CustomDropdown,
  ConfirmDialog,
  notificationService,
  formatCurrency,
  formatDate,
  onDecimalOnly,
  onDigitsOnly,
} from '@forethread/ui-components';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import ClockIcon from '@forethread/ui-components/assets/icons/clock-icon.svg?react';
import MarkIcon from '@forethread/ui-components/assets/icons/mark-with-cyrcle.svg?react';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { BULK_ORDER_ROUTES } from '../constants/routes';
import { useProjectFilterOptions } from '../hooks/useFilterOptions';
import {
  useBulkOrder,
  useChangeRequests,
  useProposeChange,
  useUpdateBulkOrder,
} from '../services/bulk-orders.service';

import { ChangeHistoryCard } from './ChangeHistoryCard';
import { DetailField } from './DetailField';

interface NewMaterialRow {
  itemReference: string;
  description: string;
  unit: string;
  quantity: string;
  pricePerUnit: string;
}

const NAKED_INPUT_CLASS = '!bg-transparent !rounded-none !border-0 !shadow-none';

const UOM_OPTIONS = [
  { value: 'pcs', label: 'pcs' },
  { value: 'kg', label: 'kg' },
  { value: 'rolls', label: 'rolls' },
  { value: 'units', label: 'units' },
  { value: 'blocks', label: 'blocks' },
  { value: 'pieces', label: 'pieces' },
  { value: 'sheets', label: 'sheets' },
  { value: 'tonnes', label: 'tonnes' },
  { value: 'pallets', label: 'pallets' },
  { value: 'm', label: 'm' },
  { value: 'l', label: 'l' },
];

const emptyMaterial = (): NewMaterialRow => ({
  itemReference: '',
  description: '',
  unit: '',
  quantity: '',
  pricePerUnit: '',
});

export interface ProposeChangePageProps {
  /** True when rendered inside the vendor app — flips approval labels */
  isVendorView?: boolean;
}

export function ProposeChangePage({ isVendorView = false }: ProposeChangePageProps = {}) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useBulkOrder(id ?? '');
  const { data: changeRequests } = useChangeRequests(id ?? '');
  const mutation = useProposeChange();
  const updateBulkOrder = useUpdateBulkOrder();
  const projectOptions = useProjectFilterOptions();
  const setTitle = usePageTitleStore((s) => s.setTitle);

  const [selectedProject, setSelectedProject] = useState('');
  const [pendingProjectChange, setPendingProjectChange] = useState<{
    projectId: string;
    projectName: string;
  } | null>(null);
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [newQty, setNewQty] = useState<Record<string, string>>({});
  const [newPrice, setNewPrice] = useState<Record<string, string>>({});
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [newMaterials, setNewMaterials] = useState<NewMaterialRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data && !initialized) {
      setTitle(data.bulkId, t('list.subtitle') as string);
      setEndDate(data.endDate ? data.endDate.split('T')[0] : '');
      setSelectedProject(data.projectName);
      setInitialized(true);
    }
    return () => setTitle(null);
  }, [data, setTitle, t, initialized]);

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

  const goBack = () => navigate(BULK_ORDER_ROUTES.bulkOrderDetail.replace(':id', id!));

  const toggleRemove = (lineItemId: string) => {
    setRemovedItems((prev) => {
      const next = new Set(prev);
      if (next.has(lineItemId)) next.delete(lineItemId);
      else next.add(lineItemId);
      return next;
    });
  };

  const addMaterial = () => setNewMaterials((prev) => [...prev, emptyMaterial()]);

  const updateMaterial = (index: number, field: keyof NewMaterialRow, value: string) => {
    setNewMaterials((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const removeMaterial = (index: number) => {
    setNewMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  // Build line item changes
  const buildLineItemChanges = () => {
    const changes: Array<{
      lineItemId?: string;
      action: 'update' | 'add' | 'remove';
      unitPrice?: number;
      quantity?: number;
      uom?: string;
      itemReference?: string;
      description?: string;
    }> = [];

    // Removed items
    for (const lineItemId of removedItems) {
      changes.push({ lineItemId, action: 'remove' });
    }

    // Updated items (new qty or new price)
    for (const li of data.lineItems) {
      if (removedItems.has(li.lineItemId)) continue;
      const qty = newQty[li.lineItemId];
      const price = newPrice[li.lineItemId];
      if (qty || price) {
        changes.push({
          lineItemId: li.lineItemId,
          action: 'update',
          ...(qty ? { quantity: Number(qty) } : {}),
          ...(price ? { unitPrice: Number(price) } : {}),
        });
      }
    }

    // New materials
    for (const m of newMaterials) {
      if (m.itemReference && m.quantity && m.unit) {
        changes.push({
          action: 'add',
          itemReference: m.itemReference,
          description: m.description,
          uom: m.unit || 'EA',
          quantity: Number(m.quantity),
          unitPrice: m.pricePerUnit ? Number(m.pricePerUnit) : 0,
        });
      }
    }

    return changes;
  };

  const hasEndDateChange = endDate && endDate !== (data.endDate ? data.endDate.split('T')[0] : '');
  const lineItemChanges = buildLineItemChanges();
  const isValid = hasEndDateChange || lineItemChanges.length > 0;

  const handleSubmit = () => {
    if (!isValid) return;

    mutation.mutate(
      {
        bulkOrderId: id!,
        input: {
          endDate: hasEndDateChange ? endDate : undefined,
          message: message || undefined,
          lineItems: lineItemChanges.length > 0 ? lineItemChanges : undefined,
        },
      },
      {
        onSuccess: () => {
          notificationService.success(t('changeRequests.proposeSuccess'));
          goBack();
        },
      },
    );
  };

  // Sort change requests desc
  const sortedCrs = [...(changeRequests ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const totalVersions = sortedCrs.length;

  const visibleLineItems = data.lineItems.filter((li) => !removedItems.has(li.lineItemId));

  return (
    <div className="flex gap-6 p-4 min-h-full">
      {/* Left sidebar */}
      <div className="w-[280px] shrink-0 flex flex-col gap-6">
        {/* Bulk Details */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground mb-3">{t('detail.bulkDetails')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <DetailField label={t('detail.bulkId')} value={data.bulkId} />
            <DetailField
              label={t('detail.status')}
              value={data.status ? (t(`status.${data.status}` as never) as string) : '-'}
            />
            <DetailField label={t('detail.vendorName')} value={data.vendorName} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <DetailField label={t('detail.createdDate')} value={formatDate(data.createdDate)} />
            <DetailField label={t('detail.validUntil')} value={formatDate(data.endDate)} />
            <DetailField label={t('detail.rfqReference')} value={data.rfqReference ?? '-'} />
            <DetailField label={t('detail.createdBy')} value={data.createdBy} />
          </div>
        </div>

        {/* Change History */}
        {sortedCrs.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-base font-bold text-foreground mb-3">
              {t('changeRequests.title')}
            </h2>
            <div className="flex flex-col gap-2">
              {sortedCrs.map((cr, index) => (
                <ChangeHistoryCard
                  key={cr.id}
                  changeRequest={cr}
                  isInitialVersion={index === sortedCrs.length - 1}
                  version={totalVersions - index}
                  rfqReference={data.rfqReference}
                  isVendorView={isVendorView}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar: Alert + Submit/Cancel */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Alert variant="info" icon={<ClockIcon className="w-5 h-5" />} className="flex-1">
            {isVendorView
              ? t('changeRequests.proposePage.infoAlertContractor')
              : t('changeRequests.proposePage.infoAlertVendor')}
          </Alert>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="primary"
              size="md"
              className="h-12 gap-2"
              disabled={!isValid || mutation.isPending}
              onClick={handleSubmit}
            >
              <MarkIcon className="w-5 h-5" />
              {mutation.isPending
                ? t('changeRequests.proposePage.submitting')
                : t('changeRequests.proposePage.submit')}
            </Button>
            <Button variant="outline" size="md" className="h-12" onClick={goBack}>
              {t('changeRequests.proposePage.cancel')}
            </Button>
          </div>
        </div>

        {/* Agreement details */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-base font-bold text-foreground">
              {t('changeRequests.proposePage.agreementDetails')}
            </h2>
            <span className="text-sm text-muted-foreground">
              {t('changeRequests.proposePage.appliedToAll')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('changeRequests.proposePage.projectName')}>
              {isVendorView ? (
                <SelectDropdown
                  value={selectedProject}
                  options={[{ value: data.projectName, label: data.projectName }]}
                />
              ) : (
                <SelectDropdown
                  value={selectedProject}
                  options={projectOptions.map((o) => ({ value: o.label, label: o.label }))}
                  onChange={(projectName) => {
                    if (projectName === selectedProject) return;
                    const option = projectOptions.find((o) => o.label === projectName);
                    if (option) {
                      setPendingProjectChange({ projectId: option.value, projectName });
                    }
                  }}
                />
              )}
            </FormField>
            <FormField label={t('changeRequests.proposePage.expirationDate')}>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                minDate={new Date().toISOString().slice(0, 10)}
              />
            </FormField>
            <FormField label={t('changeRequests.proposePage.changeReason')}>
              <Input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('changeRequests.proposePage.changeReasonPlaceholder')}
              />
            </FormField>
          </div>
        </div>

        {/* Line Items table */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-base font-bold text-foreground mb-4">
            {t('changeRequests.proposePage.lineItems')}
          </h2>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="bg-foreground/5">
                  <Th>{t('detail.lineItemId')}</Th>
                  <Th>{t('detail.itemReference')}</Th>
                  <Th>{t('detail.description')}</Th>
                  <Th>{t('detail.unit')}</Th>
                  <Th>{t('detail.qty')}</Th>
                  <Th>{t('detail.qtyRemaining')}</Th>
                  <Th>{t('changeRequests.proposePage.newQty')}</Th>
                  <Th>{t('changeRequests.proposePage.currentPrice')}</Th>
                  <Th>{t('changeRequests.proposePage.newPrice')}</Th>
                  <Th>{t('columns.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {visibleLineItems.map((item) => (
                  <LineItemRow
                    key={item.lineItemId}
                    item={item}
                    newQtyValue={newQty[item.lineItemId] ?? ''}
                    newPriceValue={newPrice[item.lineItemId] ?? ''}
                    onNewQtyChange={(v) => setNewQty((prev) => ({ ...prev, [item.lineItemId]: v }))}
                    onNewPriceChange={(v) =>
                      setNewPrice((prev) => ({ ...prev, [item.lineItemId]: v }))
                    }
                    onRemove={() => toggleRemove(item.lineItemId)}
                    isEdited={!!(newQty[item.lineItemId] || newPrice[item.lineItemId])}
                  />
                ))}
                {/* New material rows */}
                {newMaterials.map((m, idx) => (
                  <tr key={`new-${idx}`} className="border-t border-border bg-success/5">
                    <td className="p-3 text-muted-foreground border-r border-border text-xs italic">
                      new
                    </td>
                    <td className="p-3 border-r border-border last:border-r-0">
                      <Input
                        type="text"
                        value={m.itemReference}
                        onChange={(e) => updateMaterial(idx, 'itemReference', e.target.value)}
                        placeholder={t('modals.itemReferenceLabel')}
                        className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
                      />
                    </td>
                    <td className="p-3 border-r border-border last:border-r-0">
                      <Input
                        type="text"
                        value={m.description}
                        onChange={(e) => updateMaterial(idx, 'description', e.target.value)}
                        placeholder={t('modals.descriptionLabel')}
                        className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
                      />
                    </td>
                    <td className="p-3 border-r border-border last:border-r-0">
                      <CustomDropdown
                        options={UOM_OPTIONS}
                        value={m.unit}
                        onChange={(v) => updateMaterial(idx, 'unit', v)}
                        placeholder={t('modals.unitLabel')}
                        borderless
                      />
                    </td>
                    <td className="p-3 border-r border-border" />
                    <td className="p-3 border-r border-border" />
                    <td className="p-3 border-r border-border last:border-r-0">
                      <Input
                        inputMode="numeric"
                        pattern="[0-9]*"
                        onKeyDown={onDigitsOnly}
                        value={m.quantity}
                        onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)}
                        placeholder="0"
                        className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
                      />
                    </td>
                    <td className="p-3 border-r border-border" />
                    <td className="p-3 border-r border-border last:border-r-0">
                      <Input
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        onKeyDown={onDecimalOnly}
                        value={m.pricePerUnit}
                        onChange={(e) => updateMaterial(idx, 'pricePerUnit', e.target.value)}
                        placeholder="$0.00"
                        className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
                      />
                    </td>
                    <td className="p-3 border-r border-border last:border-r-0">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => removeMaterial(idx)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <DeleteIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/50">
                  <td colSpan={10} className="px-6 py-3">
                    <span className="text-sm text-muted-foreground">
                      {t('detail.totalItems')}:{' '}
                      <span className="text-foreground">
                        {visibleLineItems.length + newMaterials.length}
                      </span>
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            type="button"
            className="mt-3 text-sm font-medium text-foreground hover:text-foreground/70 transition-colors"
            onClick={addMaterial}
          >
            {t('changeRequests.proposePage.addMaterial')}
          </button>
        </div>

        {mutation.isError && (
          <Alert variant="destructive" className="mt-4">
            {t('changeRequests.proposeError')}
          </Alert>
        )}
      </div>

      {/* Confirm project reassignment dialog */}
      {pendingProjectChange && (
        <ConfirmDialog
          title={t('changeRequests.proposePage.reassignTitle')}
          message={t('changeRequests.proposePage.reassignMessage', {
            project: pendingProjectChange.projectName,
          })}
          confirmLabel={t('changeRequests.proposePage.reassignConfirm')}
          cancelLabel={t('modals.cancel')}
          onConfirm={() => {
            const { projectId, projectName } = pendingProjectChange;
            setPendingProjectChange(null);
            setSelectedProject(projectName);
            updateBulkOrder.mutate(
              { id: id!, payload: { projectId } },
              {
                onSuccess: () =>
                  notificationService.success(t('changeRequests.proposePage.projectReassigned')),
              },
            );
          }}
          onCancel={() => setPendingProjectChange(null)}
        />
      )}
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-3 text-left text-xs font-bold tracking-[0.6px] text-[hsl(var(--table-header-foreground))] border-r border-border last:border-r-0">
      {children}
    </th>
  );
}

function LineItemRow({
  item,
  newQtyValue,
  newPriceValue,
  onNewQtyChange,
  onNewPriceChange,
  onRemove,
  isEdited,
}: {
  item: BulkOrderLineItemDetail;
  newQtyValue: string;
  newPriceValue: string;
  onNewQtyChange: (v: string) => void;
  onNewPriceChange: (v: string) => void;
  onRemove: () => void;
  isEdited: boolean;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);

  const handleEditClick = () => {
    qtyRef.current?.focus();
  };

  return (
    <tr className="border-t border-border">
      <td className="p-3 text-foreground border-r border-border">{item.lineItemId}</td>
      <td className="p-3 text-foreground border-r border-border">{item.itemReference}</td>
      <td className="p-3 text-foreground border-r border-border truncate max-w-[200px]">
        {item.description}
      </td>
      <td className="p-3 text-foreground border-r border-border">{item.unit}</td>
      <td className="p-3 text-foreground border-r border-border">{item.qty}</td>
      <td className="p-3 text-foreground border-r border-border">{item.qtyRemaining}</td>
      <td className="p-3 border-r border-border last:border-r-0">
        <Input
          ref={qtyRef}
          inputMode="numeric"
          pattern="[0-9]*"
          onKeyDown={onDigitsOnly}
          value={newQtyValue}
          onChange={(e) => onNewQtyChange(e.target.value)}
          className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
        />
      </td>
      <td className="p-3 text-foreground border-r border-border">
        {formatCurrency(item.pricePerUnit)}
      </td>
      <td className="p-3 border-r border-border last:border-r-0">
        <Input
          inputMode="decimal"
          pattern="[0-9]*\.?[0-9]*"
          onKeyDown={onDecimalOnly}
          value={newPriceValue}
          onChange={(e) => onNewPriceChange(e.target.value)}
          className={`h-8 text-sm ${NAKED_INPUT_CLASS}`}
        />
      </td>
      <td className="p-3 border-r border-border last:border-r-0">
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <DeleteIcon className="w-4 h-4" />
          </button>
          <MessageBadgeIcon
            icon={<EditIcon className="w-4 h-4" />}
            hasNotification={isEdited}
            onClick={handleEditClick}
          />
        </div>
      </td>
    </tr>
  );
}
