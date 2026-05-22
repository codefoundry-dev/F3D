import type { DocExtractionResponse } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import type { BomExtractionResult } from '@forethread/shared-types';
import { Button } from '@forethread/ui-components';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  useConfirmDocExtraction,
  useDocExtractionQuery,
  useUpdateDocExtraction,
} from '../hooks/useDocExtraction';

import { BomReviewTable } from './BomReviewTable';

export interface DocExtractionReviewProps {
  /** Extraction job ID returned by createDocExtraction(). */
  extractionId: string;
  /** Optional callback fired after the user confirms the extraction. */
  onConfirmed?: (job: DocExtractionResponse) => void;
}

/**
 * Reusable review surface for any AI-extracted document. Polls the job until
 * it settles, then renders either:
 *  - the BOM line-item table when the job's type is BOM (FOR-200), or
 *  - a plain JSON editor for QUOTE / INVOICE / GENERIC types.
 */
export function DocExtractionReview({ extractionId, onConfirmed }: DocExtractionReviewProps) {
  const { t } = useTranslation(['docExtractions']);
  const query = useDocExtractionQuery(extractionId);
  const update = useUpdateDocExtraction(extractionId);
  const confirm = useConfirmDocExtraction(extractionId);
  const job = query.data;

  const isBom = job?.type === 'BOM';

  // Generic JSON editor state (used for QUOTE / INVOICE / GENERIC).
  const [draft, setDraft] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // BOM table state — held as the canonical BOM shape so we can pass it to
  // the table without lossy round-trips through JSON.
  const [bomDraft, setBomDraft] = useState<BomExtractionResult | null>(null);

  // Seed editors when a fresh editedResult lands.
  useEffect(() => {
    if (!job?.editedResult) return;
    setDraft(JSON.stringify(job.editedResult, null, 2));
    if (job.type === 'BOM') {
      setBomDraft(job.editedResult as unknown as BomExtractionResult);
    }
  }, [job?.editedResult, job?.type]);

  const onDraftChange = useCallback((value: string) => {
    setDraft(value);
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (err) {
      setParseError((err as Error).message);
    }
  }, []);

  const onSave = useCallback(async () => {
    if (isBom) {
      if (!bomDraft) return;
      await update.mutateAsync(bomDraft as unknown as Record<string, unknown>);
      setIsEditing(false);
      return;
    }
    if (parseError) return;
    const parsed = JSON.parse(draft) as Record<string, unknown>;
    await update.mutateAsync(parsed);
    setIsEditing(false);
  }, [isBom, bomDraft, parseError, draft, update]);

  const onConfirm = useCallback(async () => {
    let final: Record<string, unknown> | undefined;
    if (isBom) {
      final = isEditing && bomDraft ? (bomDraft as unknown as Record<string, unknown>) : undefined;
    } else {
      if (parseError) return;
      final = isEditing ? (JSON.parse(draft) as Record<string, unknown>) : undefined;
    }
    const next = await confirm.mutateAsync(final);
    onConfirmed?.(next);
  }, [isBom, isEditing, bomDraft, parseError, draft, confirm, onConfirmed]);

  const statusLabel = useMemo(() => {
    if (!job) return t('review.statuses.PENDING');
    return t(`review.statuses.${job.status}` as 'review.statuses.PENDING');
  }, [job, t]);

  if (query.isLoading || !job) {
    return (
      <div className="p-6" role="status" aria-live="polite">
        {t('review.statuses.PENDING')}
      </div>
    );
  }

  if (job.status === 'FAILED') {
    return (
      <div className="p-6 space-y-2" role="alert">
        <h2 className="text-lg font-semibold">{t('review.errorTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('review.errorBody', {
            code: job.errorCode ?? 'UNKNOWN',
            message: job.errorMessage ?? '',
          })}
        </p>
      </div>
    );
  }

  const isPolling = job.status === 'PENDING' || job.status === 'PROCESSING';
  const canEdit = job.status === 'COMPLETED';
  const canConfirm = job.status === 'COMPLETED';
  const saveDisabled = isBom ? false : !!parseError;

  return (
    <section className="p-6 space-y-4" aria-labelledby="doc-extraction-review-title">
      <header className="flex items-center justify-between">
        <div>
          <h2 id="doc-extraction-review-title" className="text-lg font-semibold">
            {t('review.title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('review.subtitle')}</p>
        </div>
        <div
          className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground"
          data-testid="extraction-status"
          aria-live="polite"
        >
          {statusLabel}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('review.field.type')}</dt>
          <dd className="font-medium">{job.type}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('review.field.filename')}</dt>
          <dd className="font-medium truncate">{job.file.filename}</dd>
        </div>
      </dl>

      {isPolling ? (
        <div className="border rounded-md p-6 text-sm text-muted-foreground" role="status">
          {statusLabel}
        </div>
      ) : isBom ? (
        <BomReviewTable
          value={(isEditing ? bomDraft : job.editedResult) as Record<string, unknown> | null}
          readOnly={!isEditing}
          onChange={setBomDraft}
        />
      ) : (
        <div className="space-y-2">
          <label htmlFor="extraction-editor" className="text-sm font-medium">
            {t('review.title')}
          </label>
          <textarea
            id="extraction-editor"
            data-testid="extraction-editor"
            className="w-full min-h-[280px] font-mono text-xs border rounded-md p-3"
            value={draft}
            readOnly={!isEditing}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          {parseError ? (
            <p className="text-xs text-destructive" role="alert">
              {parseError}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {canEdit && !isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            {t('review.actions.edit')}
          </Button>
        ) : null}
        {canEdit && isEditing ? (
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (job.editedResult) {
                  setDraft(JSON.stringify(job.editedResult, null, 2));
                  if (isBom) setBomDraft(job.editedResult as unknown as BomExtractionResult);
                }
                setIsEditing(false);
                setParseError(null);
              }}
            >
              {t('review.actions.cancel')}
            </Button>
            <Button onClick={() => void onSave()} disabled={saveDisabled || update.isPending}>
              {t('review.actions.save')}
            </Button>
          </>
        ) : null}
        {canConfirm ? (
          <Button
            onClick={() => void onConfirm()}
            disabled={saveDisabled || confirm.isPending}
            data-testid="confirm-extraction"
          >
            {t('review.actions.confirm')}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
