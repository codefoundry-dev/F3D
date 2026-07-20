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
import {
  Alert,
  Button,
  DatePicker,
  FormField,
  Input,
  Spinner,
  StatusErrorModal,
  StatusSuccessModal,
  Textarea,
} from '@forethread/ui-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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

function GuestChangeForm({ po, token }: { po: PoDetail; token: string }) {
  const { t } = useTranslation('purchaseOrders');
  const navigate = useNavigate();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  const backToPo = () => navigate(ROUTES.guestPurchaseOrder.replace(':token', token));

  const defaultValues = useMemo(() => poToFormDefaults(po).defaultValues, [po]);
  const form = useForm<FormValues>({ defaultValues });
  const { register, control, watch, getValues } = form;
  const { fields } = useFieldArray({ control, name: 'lineItems' });

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

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-[1000px] mx-auto flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">{t('guest.change.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('guest.change.subtitle', { poNumber: po.poNumber })}
            </p>
          </div>
          <Button variant="outline" size="sm" leftIcon={<span>&larr;</span>} onClick={backToPo}>
            {t('guest.change.back')}
          </Button>
        </div>
      </header>

      <div className="flex-1 px-6 py-6 max-w-[1000px] mx-auto w-full space-y-6">
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
                  <DatePicker value={field.value ?? ''} onChange={field.onChange} />
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
          <div className="overflow-x-auto">
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
                  <th className="py-2 pl-3 font-medium">{t('guest.change.notesColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => {
                  const source = po.lineItems[index];
                  const name = source?.materialName ?? source?.description ?? '—';
                  return (
                    <tr key={field.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-3 pr-3 text-foreground">{name}</td>
                      <td className="py-3 px-3">
                        <Input
                          inputMode="decimal"
                          {...register(`lineItems.${index}.unitPrice`, {
                            setValueAs: asNumberOrZero,
                          })}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Input
                          inputMode="numeric"
                          {...register(`lineItems.${index}.quantityOrdered`, {
                            setValueAs: asNumberOrZero,
                          })}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Controller
                          control={control}
                          name={`lineItems.${index}.expectedDeliveryDate`}
                          render={({ field: f }) => (
                            <DatePicker value={f.value ?? ''} onChange={f.onChange} />
                          )}
                        />
                      </td>
                      <td className="py-3 pl-3">
                        <Input {...register(`lineItems.${index}.notes`)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            <PoChangeDiff changedFields={changedFields} lineItemsAsCards />
          ) : (
            <p className="text-sm text-muted-foreground">{t('guest.change.noChanges')}</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" size="lg" onClick={backToPo}>
            {t('guest.change.back')}
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={!hasChanges}
            isLoading={proposeMutation.isPending}
            onClick={submit}
          >
            {t('guest.change.submit')}
          </Button>
        </div>
      </div>

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
