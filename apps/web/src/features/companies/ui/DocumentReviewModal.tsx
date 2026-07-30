import {
  reviewCompanyDocument,
  type CompanyDocumentResponse,
  type CompanyDocumentType,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Button,
  CustomDropdown,
  DatePicker,
  FormField,
  GridModal,
  notificationService,
} from '@forethread/ui-components';
import FileTextIcon from '@forethread/ui-components/assets/icons/file-text.svg?react';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const DOCUMENT_TYPES: CompanyDocumentType[] = ['INSURANCE', 'LICENSE', 'CERTIFICATION', 'OTHER'];

/** Extracted context fields shown read-only (must match reviewModal.fields.*). */
type ExtractedFieldKey =
  | 'title'
  | 'issuer'
  | 'documentNumber'
  | 'holderName'
  | 'issuedDate'
  | 'summary';

/** ISO-ish date → the YYYY-MM-DD the DatePicker takes; anything else → ''. */
function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(/^\d{4}-\d{2}-\d{2}/u);
  return match ? match[0] : '';
}

interface DocumentReviewModalProps {
  companyId: string;
  document: CompanyDocumentResponse;
  onClose: () => void;
  /** Called after the approved values were saved (refresh + close live in the tab). */
  onApproved: () => void;
}

/**
 * Human verification step for an uploaded company document (FOR-260): shows
 * the data the extraction pipeline read out of the file and lets the user
 * approve or correct the document type / expiry date before anything is
 * saved. Cancelling saves nothing.
 */
export function DocumentReviewModal({
  companyId,
  document,
  onClose,
  onApproved,
}: DocumentReviewModalProps) {
  const { t } = useTranslation(['company', 'common']);
  const extracted = document.extraction?.result ?? null;

  const [type, setType] = useState<CompanyDocumentType>(
    () => extracted?.documentType ?? (document.type as CompanyDocumentType) ?? 'OTHER',
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    () => toDateInput(extracted?.expiryDate) || toDateInput(document.expiresAt),
  );

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewCompanyDocument(companyId, document.id, {
        type,
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: () => {
      notificationService.success(t('reviewModal.approved'));
      onApproved();
    },
  });

  const typeOptions = DOCUMENT_TYPES.map((value) => ({
    value,
    label: t(`reviewModal.types.${value}`),
  }));

  // Read-only context rows for whatever else the pipeline extracted.
  const extractedRows: [ExtractedFieldKey, string][] = (
    [
      ['title', extracted?.title],
      ['issuer', extracted?.issuer],
      ['documentNumber', extracted?.documentNumber],
      ['holderName', extracted?.holderName],
      ['issuedDate', extracted?.issuedDate],
      ['summary', extracted?.summary],
    ] as [ExtractedFieldKey, string | null | undefined][]
  ).filter((row): row is [ExtractedFieldKey, string] => Boolean(row[1]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reviewMutation.mutate();
  };

  return (
    <GridModal
      onClose={onClose}
      icon={<FileTextIcon className="size-6 text-gray-700" />}
      title={t('reviewModal.title')}
      description={t('reviewModal.subtitle', { filename: document.file.filename })}
      onSubmit={handleSubmit}
      actions={
        <>
          <Button type="submit" size="lg" isLoading={reviewMutation.isPending} className="w-full">
            {reviewMutation.isPending ? t('reviewModal.approving') : t('reviewModal.approve')}
          </Button>
          <Button variant="outline" size="lg" type="button" onClick={onClose} className="w-full">
            {t('common:cancel')}
          </Button>
        </>
      }
    >
      {extractedRows.length > 0 && (
        <div className="rounded-[10px] border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.5px] text-gray-500">
            {t('reviewModal.extractedData')}
          </p>
          <dl className="flex flex-col gap-1.5">
            {extractedRows.map(([key, value]) => (
              <div key={key} className="flex items-baseline gap-2 text-sm">
                <dt className="shrink-0 font-medium text-gray-500">
                  {t(`reviewModal.fields.${key}`)}
                </dt>
                <dd className="min-w-0 break-words text-gray-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <FormField label={t('reviewModal.documentType')}>
        <CustomDropdown
          options={typeOptions}
          value={type}
          onChange={(value) => setType(value as CompanyDocumentType)}
        />
      </FormField>

      <FormField label={t('reviewModal.expiryDate')}>
        <DatePicker value={expiresAt} onChange={(date) => setExpiresAt(date)} />
        {!expiresAt && extracted?.expiryDate && (
          <p className="mt-1 text-xs text-gray-500">
            {t('reviewModal.extractedHint', { value: extracted.expiryDate })}
          </p>
        )}
      </FormField>
    </GridModal>
  );
}
