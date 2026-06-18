import { useTranslation } from '@forethread/i18n';
import { DamageDisposition, DamageType, DeliveryOutcome } from '@forethread/shared-types/client';
import { Badge, Button, RadioGroup, Select, cn } from '@forethread/ui-components';
import CircleReloadIcon from '@forethread/ui-components/assets/icons/circle-reload.svg?react';
import CrossCircleIcon from '@forethread/ui-components/assets/icons/cross-in-circle.svg?react';
import NoteIcon from '@forethread/ui-components/assets/icons/note.svg?react';
import PaperclipIcon from '@forethread/ui-components/assets/icons/paperclip.svg?react';
import { useRef } from 'react';

import { DAMAGE_TYPE_OPTIONS, DELIVERY_ATTACHMENT_ACCEPT } from '../constants';

import { resolveOutcome, type PortalLineDraft, type PortalLineStatus } from './portalLines';

/** Per-line outcome badge colours (mirrors the token style of the report-status badges). */
const OUTCOME_BADGE: Record<DeliveryOutcome, string> = {
  [DeliveryOutcome.DELIVERED]: 'bg-success/10 text-success',
  [DeliveryOutcome.PARTIALLY_DELIVERED]:
    'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  [DeliveryOutcome.DAMAGED]: 'bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]',
  [DeliveryOutcome.NOT_DELIVERED]: 'bg-muted text-muted-foreground',
  [DeliveryOutcome.REJECTED]: 'bg-destructive/10 text-destructive',
};

interface PortalLineItemProps {
  line: PortalLineDraft;
  onChange: (patch: Partial<PortalLineDraft>) => void;
}

/**
 * One mobile delivery line card (screenshots 12/13). Renders the status badge,
 * ordered qty, a Delivered-qty stepper and the Not delivered / Damaged / Rejected
 * toggles. Selecting Damaged expands the inline damage sub-form; Rejected collapses
 * the card to a single "Change status" affordance. The outcome is computed (not
 * stored) so the badge stays in sync with the delivered quantity.
 */
export function PortalLineItem({ line, onChange }: PortalLineItemProps) {
  const { t } = useTranslation('deliveries');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outcome = resolveOutcome(line);

  // Toggle a status button: clicking the active one clears it back to the
  // delivered/derived path.
  const toggleStatus = (status: Exclude<PortalLineStatus, null>) =>
    onChange({ status: line.status === status ? null : status });

  const addPhotos = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    onChange({ photos: [...line.photos, ...Array.from(files)] });
  };

  const isRejected = line.status === 'REJECTED';
  const isDamaged = line.status === 'DAMAGED';
  const isNotDelivered = line.status === 'NOT_DELIVERED';

  return (
    <div
      className="rounded-2xl border border-black/10 bg-card p-4"
      data-testid={`portal-line-${line.id}`}
    >
      {/* ── Header: material + status badge + note icon ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{line.materialName}</span>
            <Badge className={cn('shrink-0', OUTCOME_BADGE[outcome])}>
              {t(`outcome.${outcome}` as never)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {line.lineItemRef} ·{' '}
            {t('portal.report.ordered', { count: line.quantityOrdered, uom: line.uom })}
          </p>
        </div>
        <span
          aria-hidden
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/10 text-muted-foreground"
        >
          <NoteIcon className="h-4 w-4" />
        </span>
      </div>

      {/* ── Rejected → collapse to "Change status" (screenshot 13) ── */}
      {isRejected ? (
        <button
          type="button"
          onClick={() => onChange({ status: null })}
          data-testid={`portal-line-change-status-${line.id}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-black/15 bg-card py-3 text-sm font-medium text-foreground hover:bg-accent"
        >
          <CircleReloadIcon className="h-4 w-4" />
          {t('portal.report.changeStatus')}
        </button>
      ) : isDamaged ? (
        /* ── Damaged → delivered + damage steppers replace the toggles (screenshot 13) ── */
        <div className="mt-4 flex flex-col gap-4" data-testid={`portal-line-damage-${line.id}`}>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t('portal.report.deliveredQty')}
            </label>
            <QtyStepper
              className="mt-1.5"
              value={line.quantityReceived}
              uom={line.uom}
              onChange={(v) => onChange({ quantityReceived: v })}
              ariaLabel={`${t('portal.report.deliveredQty')} ${line.materialName}`}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t('portal.report.damageQty')}
            </label>
            <QtyStepper
              className="mt-1.5"
              value={line.damagedQuantity}
              uom={line.uom}
              onChange={(v) => onChange({ damagedQuantity: v })}
              ariaLabel={`${t('portal.report.damageQty')} ${line.materialName}`}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t('portal.report.damageType')}
            </label>
            <div className="mt-1.5">
              <Select
                value={line.damageType}
                aria-label={`${t('portal.report.damageType')} ${line.materialName}`}
                onChange={(e) => onChange({ damageType: e.target.value as DamageType | '' })}
              >
                <option value="">{t('portal.report.damageTypePlaceholder')}</option>
                {DAMAGE_TYPE_OPTIONS.map((dt) => (
                  <option key={dt} value={dt}>
                    {t(`damageType.${dt}` as never)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {t('portal.report.disposition')}
            </label>
            <div className="mt-1.5">
              <RadioGroup
                value={line.damageDisposition}
                onChange={(v) => onChange({ damageDisposition: v as DamageDisposition })}
                options={[
                  { value: DamageDisposition.RETURNED, label: t('portal.report.returned') },
                  { value: DamageDisposition.ACCEPTED, label: t('portal.report.accepted') },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileInputRef}
              type="file"
              accept={DELIVERY_ATTACHMENT_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = '';
              }}
            />
            <Button
              variant="primary"
              className="flex-1"
              leftIcon={<PaperclipIcon className="h-4 w-4" />}
              onClick={() => fileInputRef.current?.click()}
              data-testid={`portal-line-add-photo-${line.id}`}
            >
              {t('portal.report.addPhoto')}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              leftIcon={<CrossCircleIcon className="h-4 w-4" />}
              onClick={() => onChange({ status: null })}
            >
              {t('portal.report.cancel')}
            </Button>
          </div>

          {line.photos.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid={`portal-line-photos-${line.id}`}>
              {line.photos.map((file, i) => (
                <li key={`${file.name}-${i}`} className="truncate text-xs text-muted-foreground">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* ── Default → Delivered qty + Not Delivered (row 1), Damaged + Rejected (row 2) ── */
        <>
          {isNotDelivered ? (
            <div className="mt-4">
              <ToggleButton
                active
                className="w-full"
                onClick={() => toggleStatus('NOT_DELIVERED')}
                testId={`portal-line-not-delivered-${line.id}`}
                icon={<CrossCircleIcon className="h-4 w-4" />}
              >
                {t('portal.report.notDelivered')}
              </ToggleButton>
            </div>
          ) : (
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground">
                {t('portal.report.deliveredQty')}
              </label>
              <div className="mt-1.5 flex items-stretch gap-2">
                <QtyStepper
                  className="flex-1"
                  value={line.quantityReceived}
                  uom={line.uom}
                  onChange={(v) => onChange({ quantityReceived: v })}
                  ariaLabel={`${t('portal.report.deliveredQty')} ${line.materialName}`}
                />
                <ToggleButton
                  active={false}
                  className="flex-1"
                  onClick={() => toggleStatus('NOT_DELIVERED')}
                  testId={`portal-line-not-delivered-${line.id}`}
                  icon={<CrossCircleIcon className="h-4 w-4" />}
                >
                  {t('portal.report.notDelivered')}
                </ToggleButton>
              </div>
            </div>
          )}

          <div className="mt-2 grid grid-cols-2 gap-2">
            <ToggleButton
              active={false}
              onClick={() => toggleStatus('DAMAGED')}
              testId={`portal-line-damaged-${line.id}`}
              icon={<PaperclipIcon className="h-4 w-4" />}
            >
              {t('portal.report.damaged')}
            </ToggleButton>
            <ToggleButton
              active={false}
              filled
              variant="destructive"
              onClick={() => toggleStatus('REJECTED')}
              testId={`portal-line-reject-${line.id}`}
              icon={<CrossCircleIcon className="h-4 w-4" />}
            >
              {t('portal.report.rejected')}
            </ToggleButton>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Segmented quantity stepper ([−] [value uom] [+], screenshots 12/13) ─────── */

function QtyStepper({
  value,
  uom,
  onChange,
  ariaLabel,
  className,
}: {
  /** Kept as a string so the middle input can be empty mid-edit (see PortalLineDraft). */
  value: string;
  uom: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const current = Number(value);
  const safe = Number.isFinite(current) ? current : 0;
  const step = (delta: number) => onChange(String(Math.max(0, safe + delta)));

  return (
    <div className={cn('flex items-stretch gap-2', className)}>
      <button
        type="button"
        aria-label={`decrease ${ariaLabel}`}
        onClick={() => step(-1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/15 text-lg leading-none text-foreground hover:bg-accent"
      >
        −
      </button>
      <div className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-black/15 px-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="shrink-0 text-sm text-muted-foreground">{uom}</span>
      </div>
      <button
        type="button"
        aria-label={`increase ${ariaLabel}`}
        onClick={() => step(1)}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/15 text-lg leading-none text-foreground hover:bg-accent"
      >
        +
      </button>
    </div>
  );
}

/* ── Status toggle button ─────────────────────────────────────────────────── */

function ToggleButton({
  active,
  filled = false,
  variant = 'neutral',
  icon,
  children,
  onClick,
  testId,
  className,
}: {
  active: boolean;
  /** Render the coloured variant even when inactive (the Rejected button is always red). */
  filled?: boolean;
  variant?: 'neutral' | 'warning' | 'destructive';
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  className?: string;
}) {
  const activeClass =
    variant === 'destructive'
      ? 'border-destructive bg-destructive text-destructive-foreground'
      : variant === 'warning'
        ? 'border-[hsl(var(--badge-orange-text))] bg-[hsl(var(--badge-orange))] text-[hsl(var(--badge-orange-text))]'
        : 'border-foreground bg-foreground text-background';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-2 py-3 text-sm font-medium transition-colors',
        active || filled ? activeClass : 'border-black/15 bg-card text-foreground hover:bg-accent',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}
