import { useTranslation } from '@forethread/i18n';
import { DatePicker, Input, Textarea, Select, SelectDropdown } from '@forethread/ui-components';
import { Fragment, useState } from 'react';

import {
  type MrWizardLine,
  type MrDetailsErrors,
  type MrPriorityToggle,
} from '../wizard/wizard-types';

export interface DeliveryLocationOption {
  id: string;
  label: string;
}

/** A project member that can be CC'd on a requisition line. */
export interface MemberOption {
  id: string;
  name: string;
}

export interface StepMaterialDetailsProps {
  lines: MrWizardLine[];
  errors: MrDetailsErrors;
  locationOptions: DeliveryLocationOption[];
  /** Project members available to CC on a line. */
  memberOptions: MemberOption[];
  onPatchLine: (key: string, patch: Partial<MrWizardLine>) => void;
}

/** Header cell — bold, letter-spaced 12px label matching the RFQ/PO list tables. */
const TH = 'py-3 px-3 text-xs font-bold leading-4 tracking-[0.6px] whitespace-nowrap';
/** Body cell — top-aligned so per-cell error/help text never shifts the row. */
const TD = 'py-2.5 px-3 align-top text-foreground';

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

/** Compact Standard/High segmented control sized to live inside a table cell. */
function PriorityCell({
  value,
  onChange,
}: {
  value: MrPriorityToggle;
  onChange: (v: MrPriorityToggle) => void;
}) {
  const { t } = useTranslation('materialRequests');
  const base = 'px-3 py-1.5 text-xs transition-colors';
  const active = 'bg-foreground font-medium text-background';
  const inactive = 'bg-card text-foreground hover:bg-accent/50';
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={() => onChange('STANDARD')}
        aria-pressed={value === 'STANDARD'}
        className={`${base} ${value === 'STANDARD' ? active : inactive}`}
      >
        {t('materialDetails.priorityStandard')}
      </button>
      <button
        type="button"
        onClick={() => onChange('HIGH')}
        aria-pressed={value === 'HIGH'}
        className={`${base} border-l border-border ${value === 'HIGH' ? active : inactive}`}
      >
        {t('materialDetails.priorityHigh')}
      </button>
    </div>
  );
}

/** Note toggle icon — a small pencil/note glyph rendered inline (no asset import). */
function NoteGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.3 2.7a1.4 1.4 0 0 1 2 2L5.5 12.5l-2.7.7.7-2.7 7.8-7.8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Step 2 — "Material Details" (Figma 2002:176 frame 14:331). Lays the selected
 * lines out as a single editable table styled like the RFQ/PO list views: a
 * bold letter-spaced header bar with divider rows, one row per material, and the
 * required per-line inputs (Quantity Needed*, Priority, Need-by date*, Delivery
 * Time*, Delivery Address*) inline in the cells. The optional free-text fields
 * (CC team, Instructions, Internal notes) live in an expandable per-row drawer
 * so the table itself stays compact. Renders inside the wizard's DS card.
 */
export function StepMaterialDetails({
  lines,
  errors,
  locationOptions,
  memberOptions,
  onPatchLine,
}: StepMaterialDetailsProps) {
  const { t } = useTranslation('materialRequests');
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({});

  const colCount = 8;
  const ccOptions = memberOptions.map((member) => ({ value: member.name, label: member.name }));

  return (
    <div className="p-5 sm:p-6" data-testid="mr-details-step">
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-border bg-[hsl(var(--table-header))] text-left text-[hsl(var(--table-header-foreground))]">
              <th className={TH}>{t('materialDetails.colMaterial')}</th>
              <th className={`${TH} w-[90px]`}>{t('materialDetails.unit')}</th>
              <th className={`${TH} w-[150px]`}>
                {t('materialDetails.quantityNeeded')}
                <RequiredMark />
              </th>
              <th className={`${TH} w-[170px]`}>{t('materialDetails.priority')}</th>
              <th className={`${TH} w-[160px]`}>
                {t('materialDetails.needByDate')}
                <RequiredMark />
              </th>
              <th className={`${TH} w-[130px]`}>
                {t('materialDetails.deliveryTime')}
                <RequiredMark />
              </th>
              <th className={`${TH} w-[210px]`}>
                {t('materialDetails.deliveryAddress')}
                <RequiredMark />
              </th>
              <th className={`${TH} w-[70px]`}>{t('materialDetails.colNotes')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const lineErrors = errors[line.key] ?? {};
              const isNotesOpen = notesOpen[line.key] ?? false;
              const hasNotes =
                Boolean(line.instructions?.trim()) ||
                Boolean(line.internalNotes?.trim()) ||
                Boolean(line.ccTeamMembers?.length);
              return (
                <Fragment key={line.key}>
                  <tr className="border-b border-border align-top last:border-b-0">
                    {/* Material — name + description */}
                    <td className={TD}>
                      <p className="font-medium text-foreground">{line.materialName}</p>
                      {line.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{line.description}</p>
                      )}
                    </td>

                    {/* Unit */}
                    <td className={`${TD} whitespace-nowrap text-muted-foreground`}>{line.unit}</td>

                    {/* Quantity Needed */}
                    <td className={TD}>
                      <Input
                        type="number"
                        min={0}
                        value={line.quantity > 0 ? String(line.quantity) : ''}
                        onChange={(e) =>
                          onPatchLine(line.key, { quantity: Number(e.target.value) })
                        }
                        placeholder={t('materialDetails.quantityPlaceholder')}
                        aria-label={t('materialDetails.quantityNeeded')}
                        data-testid={`mr-qty-${line.key}`}
                      />
                      {typeof line.maxAvailable === 'number' && !lineErrors.quantity && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('materialDetails.maxAvailable', {
                            count: line.maxAvailable,
                            unit: line.unit.toLowerCase(),
                          })}
                        </p>
                      )}
                      {lineErrors.quantity === 'required' && (
                        <p className="mt-1 text-xs text-destructive">
                          {t('materialDetails.quantityNeeded')}
                        </p>
                      )}
                      {lineErrors.quantity === 'exceedsStock' && (
                        <p className="mt-1 text-xs text-destructive">
                          {t('materialDetails.maxAvailable', {
                            count: line.maxAvailable ?? 0,
                            unit: line.unit.toLowerCase(),
                          })}
                        </p>
                      )}
                    </td>

                    {/* Priority */}
                    <td className={TD}>
                      <PriorityCell
                        value={line.priority}
                        onChange={(priority) => onPatchLine(line.key, { priority })}
                      />
                    </td>

                    {/* Need by date */}
                    <td className={TD} data-testid={`mr-needby-${line.key}`}>
                      <DatePicker
                        value={line.expectedDeliveryDate ?? ''}
                        onChange={(date) => onPatchLine(line.key, { expectedDeliveryDate: date })}
                        placeholder={t('materialDetails.pickDate')}
                        editable
                      />
                      {lineErrors.expectedDeliveryDate && (
                        <p className="mt-1 text-xs text-destructive">
                          {t('materialDetails.needByDate')}
                        </p>
                      )}
                    </td>

                    {/* Delivery time */}
                    <td className={TD}>
                      <Input
                        type="time"
                        value={line.deliveryTime ?? ''}
                        onChange={(e) => onPatchLine(line.key, { deliveryTime: e.target.value })}
                        aria-label={t('materialDetails.deliveryTime')}
                        data-testid={`mr-time-${line.key}`}
                      />
                      {lineErrors.deliveryTime && (
                        <p className="mt-1 text-xs text-destructive">
                          {t('materialDetails.deliveryTime')}
                        </p>
                      )}
                    </td>

                    {/* Delivery Address */}
                    <td className={TD} data-testid={`mr-address-${line.key}`}>
                      <Select
                        value={line.deliveryLocationId ?? ''}
                        onChange={(e) =>
                          onPatchLine(line.key, { deliveryLocationId: e.target.value })
                        }
                        aria-label={t('materialDetails.deliveryAddress')}
                      >
                        <option value="">{t('materialDetails.selectAddress')}</option>
                        {locationOptions.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.label}
                          </option>
                        ))}
                      </Select>
                      {lineErrors.deliveryLocationId && (
                        <p className="mt-1 text-xs text-destructive">
                          {t('materialDetails.deliveryAddress')}
                        </p>
                      )}
                    </td>

                    {/* Notes toggle */}
                    <td className={`${TD} text-center`}>
                      <button
                        type="button"
                        onClick={() =>
                          setNotesOpen((prev) => ({ ...prev, [line.key]: !isNotesOpen }))
                        }
                        aria-label={t('materialDetails.addNotes')}
                        aria-expanded={isNotesOpen}
                        data-testid={`mr-notes-toggle-${line.key}`}
                        className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                          isNotesOpen
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <NoteGlyph />
                        {hasNotes && (
                          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
                        )}
                      </button>
                    </td>
                  </tr>

                  {/* Expandable notes drawer — its own row so the cell spans the table */}
                  {isNotesOpen && (
                    <tr className="border-b border-border last:border-b-0">
                      <td colSpan={colCount} className="bg-muted/20 px-3 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div
                            className="flex flex-col gap-1.5 sm:col-span-2"
                            data-testid={`mr-cc-${line.key}`}
                          >
                            <span className="text-sm font-medium text-foreground">
                              {t('materialDetails.ccTeam')}{' '}
                              <span className="font-normal text-muted-foreground">
                                ({t('materialDetails.optional')})
                              </span>
                            </span>
                            <SelectDropdown
                              selected={line.ccTeamMembers ?? []}
                              onSelectedChange={(names) =>
                                onPatchLine(line.key, { ccTeamMembers: names })
                              }
                              options={ccOptions}
                              placeholder={t('materialDetails.ccTeamSelect')}
                              emptyMessage={t('materialDetails.noMembers')}
                            />
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-foreground">
                              {t('materialDetails.instructions')}
                            </span>
                            <Textarea
                              value={line.instructions ?? ''}
                              onChange={(e) =>
                                onPatchLine(line.key, { instructions: e.target.value })
                              }
                              placeholder={t('materialDetails.instructionsPlaceholder')}
                              rows={3}
                              aria-label={t('materialDetails.instructions')}
                            />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-foreground">
                              {t('materialDetails.internalNotes')}{' '}
                              <span className="font-normal text-muted-foreground">
                                ({t('materialDetails.optional')})
                              </span>
                            </span>
                            <Textarea
                              value={line.internalNotes ?? ''}
                              onChange={(e) =>
                                onPatchLine(line.key, { internalNotes: e.target.value })
                              }
                              placeholder={t('materialDetails.internalNotesPlaceholder')}
                              rows={3}
                              aria-label={t('materialDetails.internalNotes')}
                            />
                          </label>
                        </div>
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
  );
}
