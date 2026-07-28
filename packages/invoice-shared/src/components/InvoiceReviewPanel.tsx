import {
  getCompanyVendors,
  getMe,
  getProjects,
  type InvoiceDetail,
  type InvoiceExtractionResult,
  type ReviewInvoicePayload,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Button,
  CustomDropdown,
  DatePicker,
  Input,
  notificationService,
} from '@forethread/ui-components';
import CheckCircleIcon from '@forethread/ui-components/assets/icons/checkcircle-icon.svg?react';
import DeleteIcon from '@forethread/ui-components/assets/icons/delete.svg?react';
import InfoTriangleIcon from '@forethread/ui-components/assets/icons/info-in-triangle.svg?react';
import PlusIcon from '@forethread/ui-components/assets/icons/plus.svg?react';
import SpinnerIcon from '@forethread/ui-components/assets/icons/spinner.svg?react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useReviewInvoice } from '../hooks/useInvoices';

// ── Form state ───────────────────────────────────────────────────────────────
// Every value is kept as a string while editing (numbers parse on save), so
// clearing a field can never silently become NaN mid-edit.

interface ReviewLineForm {
  /** Local list key — lines have no stable id until saved. */
  key: string;
  lineId: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
}

interface ReviewFormState {
  /** What the form was seeded from, so a late-arriving extraction can re-seed. */
  seededFrom: 'saved' | 'extraction' | 'blank';
  vendorId: string;
  projectId: string;
  invoiceNumber: string;
  issuedDate: string;
  dueDate: string;
  totalAmount: string;
  lines: ReviewLineForm[];
}

/** ISO-ish date → the YYYY-MM-DD the DatePicker takes; anything else → ''. */
function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(/^\d{4}-\d{2}-\d{2}/u);
  return match ? match[0] : '';
}

function numToStr(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

/** Forgiving numeric parse: strips currency symbols / thousands separators. */
function parseNum(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^0-9.-]/gu, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

export interface InvoiceReviewPanelProps {
  invoice: InvoiceDetail;
}

/**
 * Review & confirm an intake invoice (FOR-291): every extracted field —
 * vendor, invoice #, dates, total, line items — shown editable, seeded from
 * the Gemini extraction, and saved onto the invoice record.
 */
export function InvoiceReviewPanel({ invoice }: InvoiceReviewPanelProps) {
  const { t } = useTranslation('invoices');
  const reviewMutation = useReviewInvoice();

  const me = useQuery({ queryKey: ['me'], queryFn: () => getMe() });
  const companyId = me.data?.companyId;
  const vendors = useQuery({
    queryKey: ['company-vendors', companyId],
    queryFn: () => getCompanyVendors(companyId ?? ''),
    enabled: !!companyId,
  });
  const projects = useQuery({
    queryKey: ['projects-list'],
    queryFn: () => getProjects({ limit: 100 }),
  });

  const extraction = invoice.extraction;
  const extractionRunning = extraction?.status === 'PENDING' || extraction?.status === 'PROCESSING';
  const extracted: InvoiceExtractionResult | null = extraction?.result ?? null;

  const [form, setForm] = useState<ReviewFormState | null>(null);
  const [dirty, setDirty] = useState(false);
  const lineKey = useRef(0);

  const nextKey = () => {
    lineKey.current += 1;
    return `line-${lineKey.current}`;
  };

  // Seed (or re-seed) the form from the best available source: the saved
  // review, else the completed extraction, else blank. A late-completing
  // extraction may replace an untouched blank form, never the user's edits.
  useEffect(() => {
    const buildFromSaved = (): ReviewFormState => ({
      seededFrom: 'saved',
      vendorId: '', // resolved below — the detail payload carries names, not ids
      projectId: invoice.projectId ?? '',
      invoiceNumber: invoice.invoiceNumber ?? '',
      issuedDate: toDateInput(invoice.issuedDate),
      dueDate: toDateInput(invoice.dueDate),
      totalAmount: numToStr(invoice.totalAmount),
      lines: invoice.lines.map((line) => ({
        key: nextKey(),
        lineId: line.lineId ?? '',
        description: line.description,
        quantity: numToStr(line.quantity),
        unit: line.unit ?? '',
        unitPrice: numToStr(line.unitPrice),
        lineTotal: numToStr(line.lineTotal),
      })),
    });

    const buildFromExtraction = (result: InvoiceExtractionResult): ReviewFormState => ({
      seededFrom: 'extraction',
      vendorId: '',
      projectId: '',
      invoiceNumber: result.invoiceNumber ?? '',
      issuedDate: toDateInput(result.issuedDate),
      dueDate: toDateInput(result.dueDate),
      totalAmount: numToStr(result.totalAmount),
      lines: result.items.map((item) => ({
        key: nextKey(),
        lineId: item.lineId ?? '',
        description: item.description,
        quantity: numToStr(item.quantity),
        unit: item.unit ?? '',
        unitPrice: numToStr(item.unitPrice),
        lineTotal: numToStr(item.lineTotal),
      })),
    });

    if (invoice.reviewedAt) {
      if (form === null) setForm(buildFromSaved());
      return;
    }
    if (extracted) {
      if (form === null || (!dirty && form.seededFrom === 'blank')) {
        setForm(buildFromExtraction(extracted));
      }
      return;
    }
    if (form === null && !extractionRunning) {
      setForm({
        seededFrom: 'blank',
        vendorId: '',
        projectId: '',
        invoiceNumber: '',
        issuedDate: '',
        dueDate: '',
        totalAmount: '',
        lines: [],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed-once semantics; re-runs only on new data
  }, [invoice, extracted, extractionRunning]);

  const vendorOptions = useMemo(
    () => (vendors.data ?? []).map((v) => ({ value: v.id, label: v.legalName })),
    [vendors.data],
  );
  const projectOptions = useMemo(
    () => (projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
    [projects.data],
  );

  // Pre-select the vendor whose name matches the saved vendor (re-opened
  // review) or the extracted vendor name, as long as the user hasn't chosen.
  useEffect(() => {
    if (!form || dirty || form.vendorId || vendorOptions.length === 0) return;
    const wanted = invoice.vendorName ?? extracted?.vendorName;
    if (!wanted) return;
    const target = normalizeName(wanted);
    const match = vendorOptions.find((option) => {
      const name = normalizeName(option.label);
      return name === target || name.includes(target) || target.includes(name);
    });
    if (match) setForm({ ...form, vendorId: match.value });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot prefill when options arrive
  }, [vendorOptions, form?.seededFrom]);

  const update = (patch: Partial<ReviewFormState>) => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const updateLine = (key: string, patch: Partial<ReviewLineForm>) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            lines: prev.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
          }
        : prev,
    );
    setDirty(true);
  };

  const addLine = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            lines: [
              ...prev.lines,
              {
                key: nextKey(),
                lineId: '',
                description: '',
                quantity: '',
                unit: '',
                unitPrice: '',
                lineTotal: '',
              },
            ],
          }
        : prev,
    );
    setDirty(true);
  };

  const removeLine = (key: string) => {
    setForm((prev) =>
      prev ? { ...prev, lines: prev.lines.filter((line) => line.key !== key) } : prev,
    );
    setDirty(true);
  };

  const onSave = () => {
    if (!form) return;
    const payload: ReviewInvoicePayload = {
      vendorId: form.vendorId || null,
      projectId: form.projectId || null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      issuedDate: form.issuedDate || null,
      dueDate: form.dueDate || null,
      totalAmount: parseNum(form.totalAmount),
      lines: form.lines
        .filter((line) => line.description.trim() !== '')
        .map((line) => ({
          lineId: line.lineId.trim() || null,
          description: line.description.trim(),
          quantity: parseNum(line.quantity),
          unit: line.unit.trim() || null,
          unitPrice: parseNum(line.unitPrice),
          lineTotal: parseNum(line.lineTotal),
        })),
    };
    reviewMutation.mutate(
      { id: invoice.id, payload },
      {
        onSuccess: () => {
          setDirty(false);
          notificationService.success(
            t('review.savedToast', { defaultValue: 'Invoice details saved.' }),
          );
        },
      },
    );
  };

  // ── Extraction status banner ───────────────────────────────────────────────

  const banner = extractionRunning ? (
    <div data-testid="invoice-review-extracting">
      <Alert variant="info" icon={<SpinnerIcon className="size-4 animate-spin" />}>
        {t('review.extracting', {
          defaultValue: 'Reading the invoice… extracted details will appear here shortly.',
        })}
      </Alert>
    </div>
  ) : extraction?.status === 'FAILED' ? (
    <div data-testid="invoice-review-extraction-failed">
      <Alert variant="warning" icon={<InfoTriangleIcon className="size-4" />}>
        {t('review.extractionFailed', {
          defaultValue: 'The invoice could not be read automatically. Enter the details manually.',
        })}
      </Alert>
    </div>
  ) : invoice.reviewedAt ? (
    <div data-testid="invoice-review-reviewed">
      <Alert variant="success" icon={<CheckCircleIcon className="size-4" />}>
        {t('review.reviewedOn', {
          defaultValue: 'Reviewed on {{date}}. You can still correct the details until approval.',
          date: new Date(invoice.reviewedAt).toLocaleDateString('en-AU'),
        })}
      </Alert>
    </div>
  ) : extracted ? (
    <Alert variant="info" icon={<InfoTriangleIcon className="size-4" />}>
      {t('review.confirmHint', {
        defaultValue:
          'These details were read from the document automatically. Confirm or correct each field, then save.',
      })}
    </Alert>
  ) : null;

  if (!form) {
    return <div className="space-y-4 p-6">{banner}</div>;
  }

  const fieldLabel = 'text-xs font-medium text-muted-foreground';
  const extractedHint = (value: string | null | undefined) =>
    value ? (
      <p className="mt-1 text-xs text-muted-foreground">
        {t('review.extractedValue', { defaultValue: 'Extracted: {{value}}', value })}
      </p>
    ) : null;

  return (
    <div className="space-y-5 p-6" data-testid="invoice-review-panel">
      {banner}

      {/* ── Header fields ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={fieldLabel}>{t('review.vendor', { defaultValue: 'Vendor' })}</label>
          <div className="mt-1">
            <CustomDropdown
              options={vendorOptions}
              value={form.vendorId || undefined}
              onChange={(value) => update({ vendorId: value })}
              placeholder={t('review.selectVendor', { defaultValue: 'Select vendor' })}
              searchable
            />
          </div>
          {!form.vendorId && extractedHint(extracted?.vendorName ?? invoice.senderEmail)}
        </div>

        <div>
          <label className={fieldLabel}>{t('review.project', { defaultValue: 'Project' })}</label>
          <div className="mt-1">
            <CustomDropdown
              options={projectOptions}
              value={form.projectId || undefined}
              onChange={(value) => update({ projectId: value })}
              placeholder={t('review.selectProject', { defaultValue: 'Select project' })}
              searchable
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="invoice-review-number">
            {t('review.invoiceNumber', { defaultValue: 'Invoice #' })}
          </label>
          <div className="mt-1">
            <Input
              id="invoice-review-number"
              value={form.invoiceNumber}
              onChange={(e) => update({ invoiceNumber: e.target.value })}
              placeholder={t('review.invoiceNumberPlaceholder', { defaultValue: 'e.g. INV-1024' })}
              data-testid="invoice-review-number"
            />
          </div>
        </div>

        <div>
          <label className={fieldLabel}>
            {t('review.issuedDate', { defaultValue: 'Invoice date' })}
          </label>
          <div className="mt-1">
            <DatePicker value={form.issuedDate} onChange={(date) => update({ issuedDate: date })} />
          </div>
          {!form.issuedDate && extractedHint(extracted?.issuedDate)}
        </div>

        <div>
          <label className={fieldLabel}>{t('review.dueDate', { defaultValue: 'Due date' })}</label>
          <div className="mt-1">
            <DatePicker value={form.dueDate} onChange={(date) => update({ dueDate: date })} />
          </div>
          {!form.dueDate && extractedHint(extracted?.dueDate ?? extracted?.paymentTerms)}
        </div>

        <div>
          <label className={fieldLabel} htmlFor="invoice-review-total">
            {t('review.totalAmount', { defaultValue: 'Total amount' })}
          </label>
          <div className="mt-1">
            <Input
              id="invoice-review-total"
              inputMode="decimal"
              value={form.totalAmount}
              onChange={(e) => update({ totalAmount: e.target.value })}
              placeholder="0.00"
              data-testid="invoice-review-total"
            />
          </div>
        </div>
      </div>

      {/* ── Line items ───────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {t('review.lineItems', { defaultValue: 'Line items' })}
          </h3>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<PlusIcon className="size-4" />}
            onClick={addLine}
            data-testid="invoice-review-add-line"
          >
            {t('review.addLine', { defaultValue: 'Add line' })}
          </Button>
        </div>

        {form.lines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="invoice-review-no-lines">
            {t('review.noLines', {
              defaultValue: 'No line items yet. Add the billed lines from the document.',
            })}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="w-16 pb-2 pr-2 font-medium">
                    {t('review.line.lineId', { defaultValue: '#' })}
                  </th>
                  <th className="pb-2 pr-2 font-medium">
                    {t('review.line.description', { defaultValue: 'Description' })}
                  </th>
                  <th className="w-24 pb-2 pr-2 font-medium">
                    {t('review.line.quantity', { defaultValue: 'Qty' })}
                  </th>
                  <th className="w-20 pb-2 pr-2 font-medium">
                    {t('review.line.unit', { defaultValue: 'Unit' })}
                  </th>
                  <th className="w-28 pb-2 pr-2 font-medium">
                    {t('review.line.unitPrice', { defaultValue: 'Unit price' })}
                  </th>
                  <th className="w-28 pb-2 pr-2 font-medium">
                    {t('review.line.lineTotal', { defaultValue: 'Line total' })}
                  </th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody data-testid="invoice-review-lines">
                {form.lines.map((line) => (
                  <tr key={line.key} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        value={line.lineId}
                        onChange={(e) => updateLine(line.key, { lineId: e.target.value })}
                        aria-label={t('review.line.lineId', { defaultValue: '#' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        value={line.description}
                        onChange={(e) => updateLine(line.key, { description: e.target.value })}
                        aria-label={t('review.line.description', { defaultValue: 'Description' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        inputMode="decimal"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                        aria-label={t('review.line.quantity', { defaultValue: 'Qty' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        value={line.unit}
                        onChange={(e) => updateLine(line.key, { unit: e.target.value })}
                        aria-label={t('review.line.unit', { defaultValue: 'Unit' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                        aria-label={t('review.line.unitPrice', { defaultValue: 'Unit price' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        inputMode="decimal"
                        value={line.lineTotal}
                        onChange={(e) => updateLine(line.key, { lineTotal: e.target.value })}
                        aria-label={t('review.line.lineTotal', { defaultValue: 'Line total' })}
                      />
                    </td>
                    <td className="py-1.5 align-top">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={t('review.removeLine', { defaultValue: 'Remove line' })}
                        onClick={() => removeLine(line.key)}
                      >
                        <DeleteIcon className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button
          onClick={onSave}
          disabled={reviewMutation.isPending}
          isLoading={reviewMutation.isPending}
          data-testid="invoice-review-save"
        >
          {t('review.save', { defaultValue: 'Save details' })}
        </Button>
      </div>
    </div>
  );
}
