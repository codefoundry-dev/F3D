import { useTranslation } from '@forethread/i18n';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import EditIcon from '@forethread/ui-components/assets/icons/edit.svg?react';
import PackageIcon from '@forethread/ui-components/assets/icons/package.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';

import { toggleToPriority, type MrWizardLine } from '../wizard/wizard-types';

import { PriorityBadge } from './PriorityBadge';

export interface StepReviewProps {
  jobCode: string;
  projectName: string;
  lines: MrWizardLine[];
  /** Jump back to step 2 to edit a specific line. */
  onEditLine: (key: string) => void;
  onDeleteLine: (key: string) => void;
  /** Jump back to step 1 to add more materials. */
  onAddMore: () => void;
}

/**
 * Step 3 — "Review Material Request" (Figma 2002:176 frame 14:426). Summary
 * banner + an item list where each line shows its material, quantity, a priority
 * badge and edit/delete affordances, plus an "Add More Materials" link. Renders
 * inside the wizard's design-system card; the Submit / Raise PO actions live in
 * the page header.
 */
export function StepReview({
  jobCode,
  projectName,
  lines,
  onEditLine,
  onDeleteLine,
  onAddMore,
}: StepReviewProps) {
  const { t } = useTranslation('materialRequests');

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-16 text-center">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <PackageIcon className="size-6" />
        </span>
        <p className="text-sm font-medium text-foreground">{t('review.emptyTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('review.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6" data-testid="mr-review-step">
      {/* Summary banner */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-4 py-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t('review.summaryTitle')}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t('review.summarySubtitle', { code: jobCode, project: projectName })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold text-foreground">
            {t('review.itemsCount', { count: lines.length })}
          </p>
          <p className="text-xs text-muted-foreground">{t('review.totalLabel')}</p>
        </div>
      </div>

      {/* Item list */}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {lines.map((line) => (
          <li
            key={line.key}
            className="flex items-start gap-4 px-4 py-3"
            data-testid="mr-review-item"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <PackageIcon className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-sm font-medium text-foreground">{line.materialName}</p>
              {line.description && (
                <p className="truncate text-xs text-muted-foreground">{line.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('review.qtyLabel', { quantity: line.quantity, unit: line.unit })}
              </p>
              <span className="mt-0.5">
                <PriorityBadge priority={toggleToPriority(line.priority)} />
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onEditLine(line.key)}
                aria-label={t('review.edit')}
                className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <EditIcon className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteLine(line.key)}
                aria-label={t('review.delete')}
                className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <DeleteIcon className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Add more */}
      <button
        type="button"
        onClick={onAddMore}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
        data-testid="mr-add-more"
      >
        <PlusIcon className="size-4" />
        {t('review.addMore')}
      </button>
    </div>
  );
}
