import {
  type CreatePoChangeRequestInput,
  type PoDetail,
  getPublicPurchaseOrder,
  isApiError,
  proposePublicPoChange,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  type FormValues,
  PoChangeDiff,
  computePoChangedFields,
  deriveChangeType,
  hasAnyChange,
  poToFormDefaults,
} from '@forethread/po-shared';
import { MaterialImageThumb } from '@forethread/rfq-shared';
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  LineItemEditor,
  MobileActionBar,
  MobileActionBarSlot,
  Spinner,
  StatusErrorModal,
  StatusSuccessModal,
  Textarea,
  todayIso,
  ScrollTable,
  useHideMobileNav,
  useIsPhone,
  type LineItemField,
} from '@forethread/ui-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';

import { ROUTES } from '@/app/route-config';

/**
 * Public (tokenised) counterpart to the authenticated vendor change flow. A guest
 * vendor — reached via the PO portal link, no login — proposes a change request.
 *
 * The full `CreatePoWizard` is NOT reused here: its Step-2 catalogue search +
 * quote/bulk pickers hit authenticated endpoints that would 401 for a guest. This
 * lean form instead reuses only the *pure* diff engine (`poToFormDefaults` +
 * `computePoChangedFields` + `deriveChangeType`) and the shared `PoChangeDiff`
 * preview, so nothing but the tokenised propose call ever touches the network.
 */
export default function GuestChangeRequestPage() {
  const { t } = useTranslation('purchaseOrders');
  const { token } = useParams<{ token: string }>();

  const {
    data: po,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['guest-po', token],
    queryFn: () => getPublicPurchaseOrder(token ?? ''),
    enabled: !!token,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError || !po || !token) {
    const expired = isApiError(error, 403);
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="max-w-md text-center p-8">
          <Alert variant="destructive">
            {expired ? t('guest.expiredToken') : t('guest.invalidToken')}
          </Alert>
          <p className="text-sm text-muted-foreground mt-4">
            {expired ? t('guest.expiredTokenHint') : t('guest.invalidTokenHint')}
          </p>
        </div>
      </div>
    );
  }

  return <GuestChangeForm po={po} token={token} />;
}

/* ─── Form ──────────────────────────────────────────────────────────────────── */

/** One editable PO line: its form index plus the source PO line's display name. */
interface GuestLineRow {
  id: string;
  index: number;
  name: string;
  /** The line material's catalogue image (FOR-402); absent for free-text lines. */
  imageUrl?: string | null;
}

type GuestLineFieldKey = 'unitPrice' | 'qty' | 'delivery' | 'deliveryTime' | 'notes';

function GuestChangeForm({ po, token }: { po: PoDetail; token: string }) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const backToPo = () => navigate(ROUTES.guestPurchaseOrder.replace(':token', token));

  const defaultValues = useMemo(() => poToFormDefaults(po).defaultValues, [po]);
  const form = useForm<FormValues>({ defaultValues });
  const { register, control, watch, getValues } = form;
  const { fields, remove } = useFieldArray({ control, name: 'lineItems' });

  // Live diff of the edited form vs the PO — drives the preview + submit gate.
  const watchedAll = watch();
  const changedFields = useMemo(
    () => computePoChangedFields(watchedAll, po),
    // watchedAll is a fresh object each render; key on its content + the PO.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(watchedAll), po],
  );
  const hasChanges = hasAnyChange(changedFields);

  const proposeMutation = useMutation({
    mutationFn: (input: CreatePoChangeRequestInput) => proposePublicPoChange(token, input),
    onSuccess: () => setShowSuccess(true),
    onError: () => setShowError(true),
  });

  const submit = () => {
    const diff = computePoChangedFields(getValues(), po);
    if (!hasAnyChange(diff)) return;
    const message = getValues('message')?.trim() ?? '';
    proposeMutation.mutate({
      changeType: deriveChangeType(diff),
      changedFields: diff,
      message: message.length > 0 ? message : undefined,
    });
  };

  const asNumberOrZero = (v: string) => (v === '' ? 0 : Number(v));

  // No app shell here: hide the (absent) bottom nav so the footer bar sits at
  // the very bottom, and mount the bar's slot at the end of the page (B7).
  const isPhone = useIsPhone();
  useHideMobileNav();

  const rows: GuestLineRow[] = fields.map((field, index) => {
    // Rows can be removed, so match the source PO line by id, not by index (FOR-352).
    const source = po.lineItems.find((li) => li.id === field.lineItemId);
    return {
      id: field.id,
      index,
      name: source?.materialName ?? source?.description ?? '—',
      imageUrl: source?.imageUrl,
    };
  });

  // ── Line fields, defined once (ADR-0019 B10): table cells on desktop, the
  // line sheet on phones.
  const watchedLines = watchedAll.lineItems ?? [];
  const lineFields: Array<LineItemField<GuestLineRow> & { key: GuestLineFieldKey }> = [
    {
      key: 'unitPrice',
      label: t('guest.change.unitPriceColumn'),
      value: ({ index }) => watchedLines[index]?.unitPrice ?? '-',
      input: ({ index }) => (
        <Input
          inputMode="decimal"
          {...register(`lineItems.${index}.unitPrice`, {
            setValueAs: asNumberOrZero,
          })}
        />
      ),
    },
    {
      key: 'qty',
      label: t('guest.change.qtyColumn'),
      value: ({ index }) => watchedLines[index]?.quantityOrdered ?? '-',
      input: ({ index }) => (
        <Input
          inputMode="numeric"
          {...register(`lineItems.${index}.quantityOrdered`, {
            setValueAs: asNumberOrZero,
          })}
        />
      ),
    },
    {
      key: 'delivery',
      label: t('guest.change.deliveryDateColumn'),
      value: ({ index }) => {
        const date = watchedLines[index]?.expectedDeliveryDate;
        if (!date) return '-';
        return date;
      },
      input: ({ index }) => (
        <Controller
          control={control}
          name={`lineItems.${index}.expectedDeliveryDate`}
          render={({ field: f }) => (
            <DatePicker value={f.value ?? ''} onChange={f.onChange} minDate={todayIso()} />
          )}
        />
      ),
    },
    {
      key: 'deliveryTime',
      label: t('guest.change.deliveryTimeColumn'),
      input: ({ index }) => (
        <Controller
          control={control}
          name={`lineItems.${index}.deliveryTime`}
          render={({ field: f }) => (
            <input
              type="time"
              value={f.value ?? ''}
              onChange={f.onChange}
              aria-label={t('guest.change.deliveryTimeColumn')}
              className={
                isPhone
                  ? 'h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base text-foreground outline-none'
                  : 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none'
              }
            />
          )}
        />
      ),
    },
    {
      key: 'notes',
      label: t('guest.change.notesColumn'),
      input: ({ index }) => <Input {...register(`lineItems.${index}.notes`)} />,
    },
  ];
  const field = (key: GuestLineFieldKey, row: GuestLineRow): ReactNode =>
    lineFields.find((f) => f.key === key)?.input(row, row.index) ?? null;

  const backButton = (
    <Button variant="outline" size="lg" onClick={backToPo}>
      {/* The phone bar splits 50/50, so the long label would wrap. */}
      {isPhone ? t('guest.change.backShort', { defaultValue: 'Back' }) : t('guest.change.back')}
    </Button>
  );
  const submitButton = (
    <Button
      variant="primary"
      size="lg"
      disabled={!hasChanges}
      isLoading={proposeMutation.isPending}
      onClick={submit}
    >
      {t('guest.change.submit')}
    </Button>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="max-w-[1000px] mx-auto flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">{t('guest.change.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('guest.change.subtitle', { poNumber: po.poNumber })}
            </p>
          </div>
          {/* Phones: Back sits in the footer bar instead. */}
          {!isPhone && (
            <Button variant="outline" size="sm" leftIcon={<span>&larr;</span>} onClick={backToPo}>
              {t('guest.change.back')}
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-[1000px] mx-auto w-full space-y-6 md:px-6">
        {/* PO-level fields */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <FormField label={t('guest.change.paymentTerms')} optional>
              <Input
                inputMode="numeric"
                {...register('paymentTermsDays', {
                  setValueAs: (v: string) => (v === '' ? undefined : Number(v)),
                })}
              />
            </FormField>
            <FormField label={t('guest.change.plannedDeliveryDate')} optional>
              <Controller
                control={control}
                name="plannedDeliveryDate"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    minDate={todayIso()}
                  />
                )}
              />
            </FormField>
          </div>
        </div>

        {/* Line items */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            {t('guest.change.lineItemsHeading')}
          </h2>
          {isPhone ? (
            <LineItemEditor
              lines={rows}
              fields={lineFields}
              getKey={(row) => row.id}
              getTitle={(row) => (
                <span className="flex min-w-0 items-center gap-2">
                  <MaterialImageThumb plain url={row.imageUrl} name={row.name} />
                  {row.name}
                </span>
              )}
              // At least one line must remain — removing them all is a
              // cancellation, which has its own flow.
              onRemove={fields.length > 1 ? (i) => remove(i) : undefined}
              removeLabel={t('guest.change.removeLine')}
            />
          ) : (
            <ScrollTable>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">{t('guest.change.materialColumn')}</th>
                    <th className="py-2 px-3 font-medium w-32">
                      {t('guest.change.unitPriceColumn')}
                    </th>
                    <th className="py-2 px-3 font-medium w-24">{t('guest.change.qtyColumn')}</th>
                    <th className="py-2 px-3 font-medium w-44">
                      {t('guest.change.deliveryDateColumn')}
                    </th>
                    <th className="py-2 px-3 font-medium w-28">
                      {t('guest.change.deliveryTimeColumn')}
                    </th>
                    <th className="py-2 pl-3 font-medium">{t('guest.change.notesColumn')}</th>
                    <th className="py-2 pl-3 w-10" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-3 pr-3 text-foreground">
                        <span className="flex items-center gap-2">
                          <MaterialImageThumb url={row.imageUrl} name={row.name} />
                          {row.name}
                        </span>
                      </td>
                      <td className="py-3 px-3">{field('unitPrice', row)}</td>
                      <td className="py-3 px-3">{field('qty', row)}</td>
                      <td className="py-3 px-3">{field('delivery', row)}</td>
                      <td className="py-3 px-3">{field('deliveryTime', row)}</td>
                      <td className="py-3 pl-3">{field('notes', row)}</td>
                      <td className="py-3 pl-3">
                        {/* At least one line must remain — removing them all is a
                            cancellation, which has its own flow. */}
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(row.index)}
                            aria-label={t('guest.change.removeLine')}
                            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
        </div>

        {/* Message */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <FormField
            label={`${t('guest.change.messageLabel')} (${t('guest.change.messageOptional')})`}
          >
            <Controller
              control={control}
              name="message"
              render={({ field }) => (
                <Textarea
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  placeholder={t('guest.change.messagePlaceholder')}
                  rows={4}
                />
              )}
            />
          </FormField>
        </div>

        {/* Live preview of the proposed changes */}
        <div className="bg-card border border-border rounded-lg p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            {t('guest.change.previewHeading')}
          </h2>
          {hasChanges ? (
            <PoChangeDiff
              changedFields={changedFields}
              poLineItems={po.lineItems}
              lineItemsAsCards
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('guest.change.noChanges')}</p>
          )}
        </div>

        {/* Submit — the fixed footer bar on phones (B7) */}
        {isPhone ? (
          <MobileActionBar>
            {backButton}
            {submitButton}
          </MobileActionBar>
        ) : (
          <div className="flex justify-end gap-3">
            {backButton}
            {submitButton}
          </div>
        )}
      </div>
      <MobileActionBarSlot className="md:hidden" />

      {showSuccess && (
        <StatusSuccessModal
          onClose={backToPo}
          title={t('guest.change.successTitle')}
          description={t('guest.change.successMessage')}
          buttonLabel={t('guest.change.successButton')}
          redirectLabel={(s) => t('create.redirectingGeneric', { seconds: s })}
        />
      )}

      {showError && (
        <StatusErrorModal
          onClose={() => setShowError(false)}
          title={t('guest.change.errorTitle')}
          description={t('guest.change.errorMessage')}
          primaryButtonLabel={t('guest.change.tryAgain')}
          onPrimaryClick={() => {
            setShowError(false);
            submit();
          }}
        />
      )}
    </div>
  );
}
