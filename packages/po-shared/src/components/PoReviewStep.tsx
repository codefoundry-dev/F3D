import type { ProjectDetail, VendorAssignment } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { FileChip, FileDropzone, MessageBadgeIcon, Textarea } from '@forethread/ui-components';
import EditWithoutLineIcon from '@forethread/ui-components/assets/icons/edit-without-line.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditInSquareIcon from '@forethread/ui-components/assets/icons/edit-in-square.svg?react';
import type { UseFormRegister, UseFormWatch } from 'react-hook-form';

import type { FormValues } from '../schemas/create-po.schema';
import { formatCurrency } from '../utils/format';

const TH_CLASS = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-r border-border';
const TH_LAST = 'px-3 py-2.5 text-xs font-bold tracking-wide border-b border-border';
const TD_CLASS = 'px-3 py-2.5 text-sm border-b border-r border-border';
const TD_LAST = 'px-3 py-2.5 text-sm border-b border-border';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const FILE_ACCEPT = '.pdf,.xlsx,.docx,.doc,.jpg,.jpeg,.png,.webp,.svg,.csv';

interface PoReviewStepProps {
  watch: UseFormWatch<FormValues>;
  projectDetail: ProjectDetail | undefined;
  vendorsData: VendorAssignment[] | undefined;
  locationOptions: { value: string; label: string }[];
  subtotal: number;
  totalItems: number;
  totalQty: number;
  register: UseFormRegister<FormValues>;
  onEditStep?: (step: number) => void;
  attachments?: File[];
  onAddAttachments?: (files: FileList | File[]) => void;
  onRemoveAttachment?: (index: number) => void;
}

export function PoReviewStep({
  watch,
  projectDetail,
  vendorsData,
  locationOptions,
  subtotal,
  totalItems,
  totalQty,
  register,
  onEditStep,
  attachments = [],
  onAddAttachments,
  onRemoveAttachment,
}: PoReviewStepProps) {
  const { t } = useTranslation(['purchaseOrders', 'common']);
  const data = watch();
  const vendor = vendorsData?.find((v) => v.id === data.vendorId);
  const deliveryLocation = locationOptions.find((l) => l.value === data.deliveryLocationId);

  const filledLineItems = data.lineItems.filter((item) => !!item.materialName);

  const shipmentHandling = 0;
  const total = subtotal + shipmentHandling;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Step 3 of 3: {t('create.step3Title')}</h2>
        <p className="text-sm text-muted-foreground">{t('create.step3Subtitle')}</p>
      </div>

      {/* PO Information */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t('create.poInformation')}</h3>
          {onEditStep && (
            <button
              type="button"
              onClick={() => onEditStep(1)}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground/70 transition-colors"
            >
              <EditWithoutLineIcon className="w-[18.75px] h-[18.75px]" />
              {t('create.edit')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t('create.poNumber')}</span>
            <p className="font-medium">{data.documentName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.poStatus')}</span>
            <p className="font-medium">{t('status.DRAFT')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.pickUp')}</span>
            <p className="font-medium">{data.pickUp ? t('common:yes') : t('common:no')}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.projectLabel')}</span>
            <p className="font-medium">{projectDetail?.name ?? '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.paymentTermsLabel')}</span>
            <p className="font-medium">
              {data.paymentTermsDays ? `${data.paymentTermsDays} days` : '-'}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.expectedPickUpDate')}:</span>
            <p className="font-medium">{data.plannedDeliveryDate ?? '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.pickUpLocation')}</span>
            <p className="font-medium">{deliveryLocation?.label ?? '-'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.pickUpTimeExpectation')}</span>
            <p className="font-medium">-</p>
          </div>
          <div>
            <span className="text-muted-foreground">{t('create.earliestDeliveryDate')}:</span>
            <p className="font-medium">{data.plannedDeliveryDate ?? '-'}</p>
          </div>
        </div>
      </div>

      {/* Vendor Information */}
      {vendor && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-4">{t('create.vendorInformation')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t('create.vendorCompany')}</span>
              <p className="font-medium">{vendor.legalName ?? vendor.tradeName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('create.contactPerson')}</span>
              <p className="font-medium">{vendor.contactEmail ?? '-'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">{t('create.phoneNumber')}</span>
              <p className="font-medium">{vendor.contactPhone ?? '-'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t('create.lineItems')}</h3>
          {onEditStep && (
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground/70 transition-colors"
            >
              <EditWithoutLineIcon className="w-[18.75px] h-[18.75px]" />
              {t('create.edit')}
            </button>
          )}
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table
            className="w-full text-sm"
            style={{ borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <thead>
              <tr className="text-left bg-[hsl(var(--table-header))] text-[hsl(var(--table-header-foreground))]">
                <th className={TH_CLASS} style={{ width: '8%' }}>
                  {t('create.lineItemId')}
                </th>
                <th className={TH_CLASS} style={{ width: '14%' }}>
                  {t('create.itemMaterial')}
                </th>
                <th className={TH_CLASS} style={{ width: '12%' }}>
                  {t('create.description')}
                </th>
                <th className={TH_CLASS} style={{ width: '7%' }}>
                  {t('create.unit')}
                </th>
                <th className={TH_CLASS} style={{ width: '9%' }}>
                  {t('create.qtyOrdered')}
                </th>
                <th className={TH_CLASS} style={{ width: '9%' }}>
                  {t('create.pricePerUnit')}
                </th>
                <th className={TH_CLASS} style={{ width: '11%' }}>
                  {t('create.totalLineCost')}
                </th>
                <th className={TH_CLASS} style={{ width: '10%' }}>
                  {t('create.expDeliveryDate')}
                </th>
                <th className={TH_CLASS} style={{ width: '12%' }}>
                  {t('create.deliveryLocationCol')}
                </th>
                <th className={`${TH_LAST} text-center`} style={{ width: '8%' }}>
                  {t('create.actionsCol')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filledLineItems.map((item, i) => {
                const lineTotal = Number(item.unitPrice) * Number(item.quantityOrdered);
                return (
                  <tr key={i}>
                    <td className={TD_CLASS}>{i + 1}</td>
                    <td className={TD_CLASS}>{item.materialName}</td>
                    <td className={TD_CLASS}>{item.description ?? '-'}</td>
                    <td className={TD_CLASS}>{item.unitOfMeasure}</td>
                    <td className={TD_CLASS}>{item.quantityOrdered}</td>
                    <td className={TD_CLASS}>{formatCurrency(item.unitPrice)}</td>
                    <td className={TD_CLASS}>{formatCurrency(lineTotal)}</td>
                    <td className={TD_CLASS}>{item.expectedDeliveryDate ?? '-'}</td>
                    <td className={TD_CLASS}>
                      {locationOptions.find((l) => l.value === item.deliveryLocationId)?.label ??
                        '-'}
                    </td>
                    <td className={TD_LAST}>
                      <div className="flex items-center justify-center gap-2">
                        <MessageBadgeIcon
                          hasNotification={Boolean(item.notes)}
                          icon={
                            <EditInSquareIcon className="w-[18.75px] h-[18.75px] block text-foreground" />
                          }
                        />
                        <DeleteIcon className="w-[18.75px] h-[18.75px] text-foreground" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-sm">
          <div className="flex gap-6">
            <span>
              {t('create.totalItems')} {totalItems}
            </span>
            <span>
              {t('create.totalQty')} {totalQty}
            </span>
          </div>
          <div className="flex gap-6 items-center">
            <span>
              {t('create.shipmentHandling')}: {formatCurrency(shipmentHandling)}
            </span>
            <span className="font-semibold">
              {t('create.total')} {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Attachments & Message */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-2">
            {t('create.attachments')}{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({t('create.attachmentsOptional')})
            </span>
          </h3>
          <FileDropzone
            onFiles={(files) => onAddAttachments?.(files)}
            accept={FILE_ACCEPT}
            multiple
            buttonLabel={t('create.addAttachment')}
            hint={t('create.supportedFormats')}
          />

          {attachments.length > 0 && (
            <ul className="mt-3 space-y-2">
              {attachments.map((file, i) => (
                <FileChip
                  key={`${file.name}-${i}`}
                  name={file.name}
                  size={formatFileSize(file.size)}
                  onRemove={onRemoveAttachment ? () => onRemoveAttachment(i) : undefined}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="font-semibold mb-2">
            {t('create.poMessage')}{' '}
            <span className="text-muted-foreground font-normal text-sm">
              ({t('create.poMessageOptional')})
            </span>
          </h3>
          <Textarea
            {...register('message')}
            rows={4}
            placeholder={t('create.poMessagePlaceholder')}
          />
        </div>
      </div>
    </section>
  );
}
