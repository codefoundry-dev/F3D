import type { ProjectListItem, VendorListItem } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import { Button, FileChip, Textarea, cn } from '@forethread/ui-components';
import ChevronDownIcon from '@forethread/ui-components/assets/icons/chevron-down.svg?react';
import ChevronRightIcon from '@forethread/ui-components/assets/icons/chevron-right.svg?react';
import CrossIcon from '@forethread/ui-components/assets/icons/cross.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useMemo, useRef, useState } from 'react';

import type { DeliveryLocationOption } from './StepBasicInfo';
import type { WizardBasicInfo, WizardLineItem } from './wizard-types';

export interface PendingAttachment {
  key: string;
  file: File;
}

interface StepReviewSendProps {
  basicInfo: WizardBasicInfo;
  items: WizardLineItem[];
  projects: ProjectListItem[];
  locationOptions: DeliveryLocationOption[];
  vendors: VendorListItem[];
  selectedVendorIds: string[];
  attachments: PendingAttachment[];
  onAttachmentsChange: (attachments: PendingAttachment[]) => void;
  message: string;
  onMessageChange: (message: string) => void;
  onEditStep: (step: number) => void;
  onEditItem: (item: WizardLineItem) => void;
  onRemoveItem: (key: string) => void;
  onRemoveVendor: (vendorId: string) => void;
}

const ACCEPTED = '.pdf,.xlsx,.docx,.jpg,.jpeg,.csv';
const MAX_SIZE = 10 * 1024 * 1024;

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReviewCard({
  title,
  onEdit,
  editLabel,
  children,
}: {
  title: string;
  onEdit?: () => void;
  editLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-lg border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            {editLabel}
          </Button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * Step 4 — "Review & Send" (Figma 5.05): RFQ information, grouped line items
 * with note/edit/delete actions, selected vendors, optional attachments and
 * additional notes to vendors.
 */
export function StepReviewSend({
  basicInfo,
  items,
  projects,
  locationOptions,
  vendors,
  selectedVendorIds,
  attachments,
  onAttachmentsChange,
  message,
  onMessageChange,
  onEditStep,
  onEditItem,
  onRemoveItem,
  onRemoveVendor,
}: StepReviewSendProps) {
  const { t } = useTranslation('rfqs');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const projectName = (projectId: string | undefined) =>
    projects.find((project) => project.id === projectId)?.name ?? '—';
  const locationLabel = (locationId: string | undefined) =>
    locationOptions.find((location) => location.id === locationId)?.label ?? '—';

  const selectedProjects = projects.filter((project) => basicInfo.projectIds.includes(project.id));
  const selectedVendors = vendors.filter((vendor) => selectedVendorIds.includes(vendor.companyId));

  const grouped = useMemo(() => {
    const order = basicInfo.projectIds;
    const byProject = new Map<string, WizardLineItem[]>();
    for (const item of items) {
      const key = item.projectId ?? order[0] ?? 'unassigned';
      const list = byProject.get(key) ?? [];
      list.push(item);
      byProject.set(key, list);
    }
    return [...byProject.entries()];
  }, [items, basicInfo.projectIds]);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setFileError(null);
    const next = [...attachments];
    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        setFileError(t('create.review.fileTooLarge', { name: file.name }));
        continue;
      }
      next.push({ key: `${file.name}-${file.size}-${next.length}`, file });
    }
    onAttachmentsChange(next);
  };

  return (
    <div className="space-y-5">
      {/* ── RFQ Information ── */}
      <ReviewCard
        title={t('create.review.rfqInformation')}
        onEdit={() => onEditStep(0)}
        editLabel={t('create.review.edit')}
      >
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{t('create.review.documentName')}</dt>
            <dd className="text-foreground text-right">{basicInfo.documentName || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{t('create.review.responseDeadline')}</dt>
            <dd className="text-foreground text-right">{formatDate(basicInfo.responseDeadline)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{t('create.review.project')}</dt>
            <dd className="text-foreground text-right">
              {selectedProjects.map((project) => project.name).join(', ') || '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground shrink-0">{t('create.review.needByDate')}</dt>
            <dd className="text-foreground text-right">{formatDate(basicInfo.needByDate)}</dd>
          </div>
          {basicInfo.holdForRelease && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">
                {t('create.review.earliestDeliveryDate')}
              </dt>
              <dd className="text-foreground text-right">
                {formatDate(basicInfo.earliestDeliveryDate)}
              </dd>
            </div>
          )}
          {basicInfo.isPickUp ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground shrink-0">{t('create.review.pickUpLocation')}</dt>
              <dd className="text-foreground text-right">{basicInfo.pickUpLocation || '—'}</dd>
            </div>
          ) : (
            <div className="flex justify-between gap-4 md:col-span-2">
              <dt className="text-muted-foreground shrink-0">{t('create.review.deliveryLocation')}</dt>
              <dd className="text-foreground text-right">
                {basicInfo.deliveryLocationIds.map((id) => locationLabel(id)).join('; ') || '—'}
              </dd>
            </div>
          )}
        </dl>
      </ReviewCard>

      {/* ── Line Items ── */}
      <ReviewCard
        title={t('create.review.lineItems')}
        onEdit={() => onEditStep(1)}
        editLabel={t('create.review.edit')}
      >
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]" data-testid="review-line-items">
            <thead>
              <tr className="text-left text-xs text-muted-foreground bg-muted/40">
                <th className="font-medium py-2.5 px-3">{t('create.review.colLineItemId')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colItemMaterial')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colDescription')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colUnit')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colQuantity')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colExpDelivery')}</th>
                <th className="font-medium py-2.5 px-3">{t('create.review.colDeliveryLocation')}</th>
                <th className="font-medium py-2.5 px-3 w-[110px]">{t('create.review.colActions')}</th>
              </tr>
            </thead>
            {grouped.map(([groupProjectId, groupItems]) => {
              const isCollapsed = collapsed[groupProjectId] ?? false;
              return (
                <tbody key={groupProjectId}>
                  <tr className="bg-muted/60">
                    <td colSpan={8} className="py-2 px-3">
                      <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium text-foreground"
                        onClick={() =>
                          setCollapsed((prev) => ({ ...prev, [groupProjectId]: !isCollapsed }))
                        }
                      >
                        {isCollapsed ? (
                          <ChevronRightIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        )}
                        {projectName(groupProjectId)}
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    groupItems.map((item) => (
                      <tr key={item.key} className="border-t border-border">
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap">
                          {item.serverId ? item.serverId.slice(0, 8).toUpperCase() : '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          {item.materialName}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {item.description ?? '—'}
                        </td>
                        <td className="py-2.5 px-3">{item.uom}</td>
                        <td className="py-2.5 px-3">{item.quantity}</td>
                        <td className="py-2.5 px-3">{formatDate(item.expectedDeliveryDate)}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {locationLabel(item.deliveryLocationId)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span
                              className={cn(
                                'relative p-1.5 text-muted-foreground',
                                !item.notes && 'opacity-40',
                              )}
                              title={item.notes}
                            >
                              <NoteIcon className="w-4 h-4" />
                              {item.notes && (
                                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-destructive" />
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => onEditItem(item)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                              aria-label={t('create.review.editItem')}
                              data-testid={`review-edit-${item.key}`}
                            >
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.key)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                              aria-label={t('create.review.removeItem')}
                              data-testid={`review-remove-${item.key}`}
                            >
                              <DeleteIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              );
            })}
          </table>
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('create.lineItems.totalItems')}</span>
            <span className="font-semibold text-foreground">{items.length}</span>
          </div>
        </div>
      </ReviewCard>

      {/* ── Selected Vendors ── */}
      <ReviewCard
        title={t('create.review.selectedVendors')}
        onEdit={() => onEditStep(0)}
        editLabel={t('create.review.edit')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {selectedVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                  {vendor.companyName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() ?? '')
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{vendor.companyName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {vendor.specialisations[0] ?? (vendor.categories.join(', ') || '—')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveVendor(vendor.companyId)}
                className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label={t('create.vendors.remove', { name: vendor.companyName })}
              >
                <CrossIcon className="w-3 h-3" />
              </button>
            </div>
          ))}
          {selectedVendors.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('create.vendors.selectAtLeastOne')}</p>
          )}
        </div>
      </ReviewCard>

      {/* ── Attachments + additional notes ── */}
      <section className="bg-card rounded-lg border border-border p-5 space-y-5">
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            {t('create.review.attachments')}{' '}
            <span className="text-muted-foreground font-normal">({t('create.optional')})</span>
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              type="button"
              variant="outline"
              leftIcon={<PaperclipIcon className="w-4 h-4" />}
              onClick={() => fileInputRef.current?.click()}
              data-testid="add-attachment"
            >
              {t('create.review.addAttachment')}
            </Button>
            <span className="text-xs text-muted-foreground">{t('create.review.attachmentHint')}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {attachments.map((attachment) => (
                <FileChip
                  key={attachment.key}
                  name={attachment.file.name}
                  onRemove={() =>
                    onAttachmentsChange(attachments.filter((a) => a.key !== attachment.key))
                  }
                />
              ))}
            </div>
          )}
          {fileError && <p className="text-xs text-destructive mt-2">{fileError}</p>}
        </div>

        <div className="border-t border-border pt-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              {t('create.review.additionalNotes')}{' '}
              <span className="text-muted-foreground font-normal">({t('create.optional')})</span>
            </span>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder={t('create.review.additionalNotesPlaceholder')}
              data-testid="rfq-message"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
