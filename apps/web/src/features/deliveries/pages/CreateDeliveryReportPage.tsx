import type { PoLineItemDetail } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { usePurchaseOrder } from '@forethread/po-shared';
import { usePageTitleStore } from '@forethread/rfq-shared';
import { DeliveryOutcome } from '@forethread/shared-types/client';
import type { CreateDeliveryReportLineInput } from '@forethread/shared-types/client';
import {
  Button,
  FileChip,
  FileDropzone,
  Input,
  Select,
  Spinner,
  Textarea,
  cn,
  notificationService,
} from '@forethread/ui-components';
import CheckIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

import { DamageDetailsForm, EMPTY_DAMAGE_DRAFT, type DamageDraft } from '../components/DamageDetailsForm';
import { SelectPoModal } from '../components/SelectPoModal';
import { DELIVERY_ATTACHMENT_ACCEPT, DELIVERY_OUTCOME_OPTIONS } from '../constants';
import {
  useCreateDeliveryReport,
  useUploadDeliveryAttachment,
  useUploadDeliveryLinePhoto,
} from '../services/deliveries.service';

interface LineRow {
  poLineItemId: string;
  lineItemRef: string;
  materialName: string;
  description: string | null;
  uom: string;
  quantityOrdered: number;
  quantityReceived: string;
  outcome: DeliveryOutcome;
  damage: DamageDraft;
  /** Whether the inline damage panel is expanded (auto-opens on DAMAGED). */
  damageOpen: boolean;
}

function poLineToRow(li: PoLineItemDetail): LineRow {
  return {
    poLineItemId: li.id,
    lineItemRef: li.materialCode ?? String(li.lineNumber),
    materialName: li.materialName ?? li.description ?? `#${li.lineNumber}`,
    description: li.description,
    uom: li.unitOfMeasure,
    quantityOrdered: li.quantityOrdered,
    quantityReceived: String(li.quantityOrdered),
    outcome: DeliveryOutcome.DELIVERED,
    damage: { ...EMPTY_DAMAGE_DRAFT },
    damageOpen: false,
  };
}

function isRowValid(row: LineRow): boolean {
  const qty = Number(row.quantityReceived);
  if (row.quantityReceived.trim() === '' || !Number.isInteger(qty) || qty < 0) return false;
  if (row.outcome === DeliveryOutcome.DAMAGED) {
    const dmg = Number(row.damage.damagedQuantity);
    if (!Number.isInteger(dmg) || dmg <= 0) return false;
    if (!row.damage.damageType) return false;
    if (!row.damage.damageDisposition) return false;
  }
  return true;
}

/**
 * Create a Delivery report (screenshots 05/06/07). Seeds a line-item table from
 * the PO, captures Qty received + Outcome per line (Damaged reveals the inline
 * damage sub-form), plus optional attachments + an overall report note. On submit
 * the report is created, then photos/attachments are uploaded, then we route to
 * the detail page.
 */
export default function CreateDeliveryReportPage() {
  const { t } = useTranslation('deliveries');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const poIdParam = searchParams.get('poId');
  const setPageTitle = usePageTitleStore((s) => s.setTitle);

  const [poId, setPoId] = useState<string | null>(poIdParam);
  const [showPicker, setShowPicker] = useState(false);
  const { data: po, isLoading, isError } = usePurchaseOrder(poId ?? '');

  useEffect(() => {
    setPageTitle(t('create.title'), t('create.subtitle'), ROUTES.deliveries);
    return () => setPageTitle(null);
  }, [setPageTitle, t]);

  const [rows, setRows] = useState<LineRow[]>([]);
  const [overallNotes, setOverallNotes] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);

  // Seed rows once the PO loads.
  useEffect(() => {
    if (po) setRows((po.lineItems ?? []).map(poLineToRow));
  }, [po]);

  const createMutation = useCreateDeliveryReport();
  const uploadAttachment = useUploadDeliveryAttachment();
  const uploadLinePhoto = useUploadDeliveryLinePhoto();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allValid = useMemo(() => rows.length > 0 && rows.every(isRowValid), [rows]);

  const updateRow = (id: string, patch: Partial<LineRow>) =>
    setRows((prev) => prev.map((r) => (r.poLineItemId === id ? { ...r, ...patch } : r)));

  const setOutcome = (id: string, outcome: DeliveryOutcome) =>
    setRows((prev) =>
      prev.map((r) =>
        r.poLineItemId === id
          ? { ...r, outcome, damageOpen: outcome === DeliveryOutcome.DAMAGED ? true : r.damageOpen }
          : r,
      ),
    );

  const handleSubmit = async () => {
    if (!po || !allValid) return;
    setIsSubmitting(true);
    try {
      const lines: CreateDeliveryReportLineInput[] = rows.map((r) => ({
        poLineItemId: r.poLineItemId,
        quantityReceived: Number(r.quantityReceived),
        outcome: r.outcome,
        ...(r.outcome === DeliveryOutcome.DAMAGED
          ? {
              damagedQuantity: Number(r.damage.damagedQuantity),
              damageType: (r.damage.damageType || undefined),
              damageDisposition: r.damage.damageDisposition ?? undefined,
            }
          : {}),
      }));

      const report = await createMutation.mutateAsync({
        purchaseOrderId: po.id,
        deliveryLocationId: po.deliveryLocationId ?? undefined,
        projectId: po.projectId,
        vendorId: po.vendor?.id,
        overallNotes: overallNotes.trim() || undefined,
        lines,
      });

      // Map created report lines back to source PO lines so photos land on the
      // right line. The detail response carries poLineItemId per line.
      const lineIdByPoLine = new Map(report.lines.map((l) => [l.poLineItemId, l.id]));

      const uploads: Promise<unknown>[] = [];
      for (const r of rows) {
        if (r.outcome === DeliveryOutcome.DAMAGED && r.damage.photos.length > 0) {
          const lineId = lineIdByPoLine.get(r.poLineItemId);
          if (lineId) {
            for (const file of r.damage.photos) {
              uploads.push(uploadLinePhoto.mutateAsync({ id: report.id, lineId, file }));
            }
          }
        }
      }
      for (const file of attachments) {
        uploads.push(uploadAttachment.mutateAsync({ id: report.id, file }));
      }
      // Best-effort: a failed evidence upload shouldn't block navigation to the
      // created report.
      await Promise.allSettled(uploads);

      notificationService.success(t('create.submitted'));
      navigate(ROUTES.deliveryDetail.replace(':id', report.id));
    } catch {
      notificationService.error(t('create.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── No PO context → picker ───────────────────────────────────────────────
  if (!poId) {
    return (
      <div className="px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t('create.noPo')}</p>
          <p className="mt-1 mb-4 text-xs text-muted-foreground">{t('create.noPoHint')}</p>
          <Button variant="primary" onClick={() => setShowPicker(true)} data-testid="delivery-pick-po">
            {t('create.selectPo')}
          </Button>
        </div>
        <SelectPoModal
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(picked) => {
            setShowPicker(false);
            setPoId(picked.id);
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po) {
    return <div className="py-16 text-center text-muted-foreground">{t('create.loadFailed')}</div>;
  }

  return (
    <div className="flex flex-col px-4 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-6">
      {/* ═══ Line Items card ═══ */}
      <div className="rounded-[14px] border border-border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t('create.lineItems')}</h2>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm" data-testid="delivery-create-table">
            <thead>
              <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
                {(
                  [
                    'lineItemId',
                    'itemMaterial',
                    'description',
                    'unit',
                    'qtyOrdered',
                    'qtyReceived',
                    'outcome',
                    'actions',
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    className="whitespace-nowrap px-3 py-3 text-xs font-bold leading-4 tracking-[0.4px]"
                  >
                    {t(`create.columns.${col}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isDamaged = row.outcome === DeliveryOutcome.DAMAGED;
                const qtyInvalid =
                  row.quantityReceived.trim() === '' ||
                  !Number.isInteger(Number(row.quantityReceived)) ||
                  Number(row.quantityReceived) < 0;
                return (
                  <Fragment key={row.poLineItemId}>
                    <tr
                      className="border-b border-border last:border-b-0"
                      data-testid={`delivery-row-${row.poLineItemId}`}
                    >
                      <td className="px-3 py-2.5 text-foreground">{row.lineItemRef}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground">{row.materialName}</td>
                      <td className="max-w-[260px] truncate px-3 py-2.5 text-foreground">
                        {row.description ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 text-foreground">{row.uom}</td>
                      <td className="px-3 py-2.5 text-foreground">{row.quantityOrdered}</td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={row.quantityReceived}
                          aria-label={`${t('create.columns.qtyReceived')} ${row.materialName}`}
                          aria-invalid={qtyInvalid}
                          onChange={(e) =>
                            updateRow(row.poLineItemId, { quantityReceived: e.target.value })
                          }
                          className={cn('w-24', qtyInvalid && 'border-destructive')}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={row.outcome}
                          aria-label={`${t('create.columns.outcome')} ${row.materialName}`}
                          onChange={(e) =>
                            setOutcome(row.poLineItemId, e.target.value as DeliveryOutcome)
                          }
                          className="w-[150px]"
                        >
                          {DELIVERY_OUTCOME_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {t(`outcome.${o}`)}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          disabled={!isDamaged}
                          aria-label={t('damage.title')}
                          data-testid={`delivery-edit-damage-${row.poLineItemId}`}
                          onClick={() =>
                            updateRow(row.poLineItemId, { damageOpen: !row.damageOpen })
                          }
                          className={cn(
                            'rounded-lg border border-border p-2 transition-colors',
                            isDamaged
                              ? 'text-destructive hover:bg-accent'
                              : 'text-muted-foreground/50 cursor-not-allowed',
                          )}
                        >
                          <EditIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {isDamaged && row.damageOpen && (
                      <tr className="border-b border-border">
                        <td colSpan={8} className="px-3 py-4">
                          <DamageDetailsForm
                            lineRef={row.poLineItemId}
                            value={row.damage}
                            onChange={(damage) => updateRow(row.poLineItemId, { damage })}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Attachments + Report ═══ */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 rounded-[14px] border border-border bg-card p-4 sm:p-6">
          <p className="mb-3 text-sm font-medium text-foreground">
            {t('create.attachments')}{' '}
            <span className="text-muted-foreground">{t('create.optional')}</span>
          </p>
          <FileDropzone
            onFiles={(files) => setAttachments((prev) => [...prev, ...Array.from(files)])}
            accept={DELIVERY_ATTACHMENT_ACCEPT}
            multiple
            buttonLabel={t('create.addAttachment')}
            hint={t('create.attachmentHint')}
          />
          {attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2" data-testid="delivery-attachment-list">
              {attachments.map((file, i) => (
                <FileChip
                  key={`${file.name}-${i}`}
                  name={file.name}
                  onRemove={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 rounded-[14px] border border-border bg-card p-4 sm:p-6">
          <p className="mb-3 text-sm font-medium text-foreground">
            {t('create.report')}{' '}
            <span className="text-muted-foreground">{t('create.optional')}</span>
          </p>
          <Textarea
            rows={5}
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            placeholder={t('create.reportPlaceholder')}
            aria-label={t('create.report')}
            data-testid="delivery-overall-notes"
          />
        </div>
      </div>

      {/* ═══ Footer ═══ */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => navigate(ROUTES.deliveries)}
          disabled={isSubmitting}
        >
          {t('create.cancel')}
        </Button>
        <Button
          variant="primary"
          rightIcon={<CheckIcon className="h-4 w-4" />}
          isLoading={isSubmitting}
          disabled={!allValid}
          onClick={() => void handleSubmit()}
          data-testid="delivery-submit"
        >
          {t('create.submit')}
        </Button>
      </div>
    </div>
  );
}
