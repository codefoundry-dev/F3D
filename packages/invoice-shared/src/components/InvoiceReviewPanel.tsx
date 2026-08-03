import {
  getCompanyVendors,
  getMe,
  getProjects,
  getPurchaseOrders,
  type InvoiceDetail,
  type InvoiceExtractionResult,
  type InvoicePoMatchLine,
  type InvoicePoMatchResult,
  type ReviewInvoicePayload,
} from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  Alert,
  Badge,
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

import { useInvoicePoMatch, useReviewInvoice } from '../hooks/useInvoices';

// ── Form state ───────────────────────────────────────────────────────────────
// Every value is kept as a string while editing (numbers parse on save), so
// clearing a field can never silently become NaN mid-edit.

interface ReviewLineForm {
  /** Local list key — lines have no stable id until saved. */
  key: string;
  /** The saved InvoiceLineItem id this row came from; PO-match flags (FOR-293) key on it. */
  savedId?: string;
  lineId: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
  /** Buyer-side accounting coding (FOR-295) — reviewer-entered, never extracted. */
  costCode: string;
  glAccount: string;
}

interface ReviewFormState {
  /** What the form was seeded from, so a late-arriving extraction can re-seed. */
  seededFrom: 'saved' | 'extraction' | 'blank';
  vendorId: string;
  projectId: string;
  /** The PO the invoice bills against (FOR-293). */
  relatedPoId: string;
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
  const pos = useQuery({
    queryKey: ['invoice-review-pos'],
    queryFn: () => getPurchaseOrders({ limit: 100 }),
  });

  // Invoice↔PO reconciliation (FOR-293): PO suggestion + per-line variance flags.
  const poMatch = useInvoicePoMatch(invoice.id);
  const matchResult: InvoicePoMatchResult | undefined = poMatch.data;

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
      relatedPoId: invoice.relatedPo ?? '',
      invoiceNumber: invoice.invoiceNumber ?? '',
      issuedDate: toDateInput(invoice.issuedDate),
      dueDate: toDateInput(invoice.dueDate),
      totalAmount: numToStr(invoice.totalAmount),
      lines: invoice.lines.map((line) => ({
        key: nextKey(),
        savedId: line.id,
        lineId: line.lineId ?? '',
        description: line.description,
        quantity: numToStr(line.quantity),
        unit: line.unit ?? '',
        unitPrice: numToStr(line.unitPrice),
        lineTotal: numToStr(line.lineTotal),
        costCode: line.costCode ?? '',
        glAccount: line.glAccount ?? '',
      })),
    });

    const buildFromExtraction = (result: InvoiceExtractionResult): ReviewFormState => ({
      seededFrom: 'extraction',
      vendorId: '',
      projectId: '',
      relatedPoId: '',
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
        // Accounting coding is internal to the buyer — never on the document.
        costCode: '',
        glAccount: '',
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
        relatedPoId: '',
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
  // Company POs, guaranteed to include the auto-matched/candidate/linked PO
  // even when it falls outside the first page of the list.
  const poOptions = useMemo(() => {
    const byId = new Map<string, string>();
    (pos.data?.items ?? []).forEach((po) => byId.set(po.id, po.poNumber ?? po.id));
    matchResult?.poCandidates.forEach((po) => byId.set(po.id, po.poNumber));
    if (matchResult?.po) byId.set(matchResult.po.id, matchResult.po.poNumber);
    if (invoice.relatedPo)
      byId.set(invoice.relatedPo, invoice.relatedPoNumber ?? invoice.relatedPo);
    return [...byId.entries()].map(([value, label]) => ({ value, label }));
  }, [pos.data, matchResult, invoice.relatedPo, invoice.relatedPoNumber]);

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
    // Functional update: the prefill may land between other state writes and
    // must never clobber them.
    if (match) {
      setForm((prev) => (prev && !prev.vendorId ? { ...prev, vendorId: match.value } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot prefill when options arrive
  }, [vendorOptions, form?.seededFrom]);

  // Pre-select the PO the reconciler resolved from the document's PO reference
  // (FOR-293), as long as the user hasn't chosen one. Keyed on seededFrom like
  // the vendor prefill above: a match that resolves before the form seeds
  // (cached query + slow extraction) must re-apply once the form exists.
  useEffect(() => {
    if (dirty) return;
    if (matchResult?.resolution !== 'AUTO_MATCHED' || !matchResult.po) return;
    const poId = matchResult.po.id;
    setForm((prev) => (prev && !prev.relatedPoId ? { ...prev, relatedPoId: poId } : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot prefill; the functional update never clobbers a user choice
  }, [matchResult, dirty, form?.seededFrom]);

  // PO-match flags are computed server-side from the *saved* lines, keyed here
  // by the saved line id (rows added since the last save carry no flags yet).
  const matchByLineId = useMemo(() => {
    const map = new Map<string, InvoicePoMatchLine>();
    matchResult?.lines.forEach((line) => map.set(line.invoiceLineId, line));
    return map;
  }, [matchResult]);

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
                costCode: '',
                glAccount: '',
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

  // Approval is refused server-side until vendor, project and amount are all
  // persisted (FOR-290/291); the banner and save toast below must not read as
  // "done" while any of them is still missing.
  const reviewComplete =
    invoice.vendorName !== null && invoice.projectId !== null && invoice.totalAmount !== null;

  const onSave = () => {
    if (!form) return;
    const payload: ReviewInvoicePayload = {
      vendorId: form.vendorId || null,
      projectId: form.projectId || null,
      relatedPoId: form.relatedPoId || null,
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
          costCode: line.costCode.trim() || null,
          glAccount: line.glAccount.trim() || null,
        })),
    };
    reviewMutation.mutate(
      { id: invoice.id, payload },
      {
        onSuccess: () => {
          setDirty(false);
          // A save missing any approve-critical field is a draft, not a done
          // review — say so instead of a bare success.
          if (!payload.vendorId || !payload.projectId || payload.totalAmount === null) {
            notificationService.info(
              t('review.savedIncompleteToast', {
                defaultValue:
                  'Details saved. Set the vendor, project, and total amount before this invoice can be approved.',
              }),
            );
          } else {
            notificationService.success(
              t('review.savedToast', { defaultValue: 'Invoice details saved.' }),
            );
          }
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
  ) : invoice.reviewedAt && !reviewComplete ? (
    <div data-testid="invoice-review-incomplete">
      <Alert variant="warning" icon={<InfoTriangleIcon className="size-4" />}>
        {t('review.reviewedIncomplete', {
          defaultValue:
            'Reviewed on {{date}}, but the vendor, project, and total amount must all be set and saved before this invoice can be approved.',
          date: new Date(invoice.reviewedAt).toLocaleDateString('en-AU'),
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

  // ── PO match banner (FOR-293) ──────────────────────────────────────────────
  // Surfaces how the PO was resolved and the per-line variance totals; the
  // flags themselves sit on each line row below.

  const showLineFlags = !!matchResult?.po && matchResult.lines.length > 0;

  const matchBanner = (() => {
    if (!matchResult) return null;
    const warnIcon = <InfoTriangleIcon className="size-4" />;

    if (matchResult.resolution === 'NO_REFERENCE') {
      return (
        <div data-testid="invoice-review-match-no-reference">
          <Alert variant="warning" icon={warnIcon}>
            {t('review.match.noReference', {
              defaultValue:
                'No PO reference was found on this invoice. Select the purchase order manually if one exists.',
            })}
          </Alert>
        </div>
      );
    }
    if (matchResult.resolution === 'NOT_FOUND') {
      return (
        <div data-testid="invoice-review-match-not-found">
          <Alert variant="warning" icon={warnIcon}>
            {t('review.match.notFound', {
              defaultValue:
                'The document cites "{{refs}}", but no matching purchase order was found.',
              refs: matchResult.poReferences.join(', '),
            })}
          </Alert>
        </div>
      );
    }
    if (matchResult.resolution === 'AMBIGUOUS') {
      return (
        <div data-testid="invoice-review-match-ambiguous">
          <Alert variant="warning" icon={warnIcon}>
            {t('review.match.ambiguous', {
              defaultValue:
                "The document's PO references match several purchase orders — select the right one.",
            })}
          </Alert>
        </div>
      );
    }

    // LINKED / AUTO_MATCHED
    if (!matchResult.po) return null;
    const poNumber = matchResult.po.poNumber;
    const { lineCount, matchedCount, priceVarianceCount, quantityVarianceCount, unexpectedCount } =
      matchResult.summary;
    const issueCount = priceVarianceCount + quantityVarianceCount + unexpectedCount;

    return (
      <div className="space-y-2" data-testid="invoice-review-match-banner">
        {lineCount === 0 ? (
          matchResult.resolution === 'AUTO_MATCHED' ? (
            <div data-testid="invoice-review-match-auto">
              <Alert variant="info" icon={warnIcon}>
                {t('review.match.autoMatched', {
                  defaultValue:
                    'This invoice cites {{poNumber}} — confirmed automatically from the document. Save to link it.',
                  poNumber,
                })}
              </Alert>
            </div>
          ) : null
        ) : issueCount > 0 ? (
          <div data-testid="invoice-review-match-issues">
            <Alert variant="warning" icon={warnIcon}>
              {t('review.match.summaryIssues', {
                defaultValue:
                  'Checked against {{poNumber}}: {{matched}} of {{count}} line(s) matched, {{price}} price variance(s), {{qty}} quantity variance(s), {{unexpected}} not on the PO.',
                poNumber,
                matched: matchedCount,
                count: lineCount,
                price: priceVarianceCount,
                qty: quantityVarianceCount,
                unexpected: unexpectedCount,
              })}
            </Alert>
          </div>
        ) : (
          <div data-testid="invoice-review-match-clean">
            <Alert variant="success" icon={<CheckCircleIcon className="size-4" />}>
              {t('review.match.summaryClean', {
                defaultValue: 'All {{count}} line(s) match {{poNumber}} — no variances.',
                count: lineCount,
                poNumber,
              })}
            </Alert>
          </div>
        )}
        {matchResult.vendorMismatch && (
          <div data-testid="invoice-review-match-vendor">
            <Alert variant="warning" icon={warnIcon}>
              {t('review.match.vendorMismatch', {
                defaultValue: 'The selected vendor differs from the vendor on {{poNumber}}.',
                poNumber,
              })}
            </Alert>
          </div>
        )}
        {matchResult.unbilledPoLines.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t('review.match.unbilled', {
              defaultValue: '{{count}} PO line(s) are not billed on this invoice.',
              count: matchResult.unbilledPoLines.length,
            })}
          </p>
        )}
      </div>
    );
  })();

  const signed = (value: number): string => (value > 0 ? `+${value}` : `${value}`);

  const lineFlagBadges = (line: ReviewLineForm) => {
    const lineMatch = line.savedId ? matchByLineId.get(line.savedId) : undefined;
    if (!lineMatch) return <span className="text-muted-foreground">—</span>;
    if (lineMatch.flags.length === 0) {
      return (
        <Badge color="success">{t('review.match.flag.matched', { defaultValue: 'Matched' })}</Badge>
      );
    }
    return (
      <div className="flex flex-wrap gap-1">
        {lineMatch.flags.includes('PRICE_VARIANCE') && lineMatch.priceVariancePct !== null && (
          <Badge color="warning">
            {t('review.match.flag.price', {
              defaultValue: 'Price {{pct}}%',
              pct: signed(lineMatch.priceVariancePct),
            })}
          </Badge>
        )}
        {lineMatch.flags.includes('QTY_VARIANCE') && lineMatch.quantityDelta !== null && (
          <Badge color="warning">
            {t('review.match.flag.qty', {
              defaultValue: 'Qty {{delta}}',
              delta: signed(lineMatch.quantityDelta),
            })}
          </Badge>
        )}
        {lineMatch.flags.includes('NOT_ON_PO') && (
          <Badge color="red">{t('review.match.flag.notOnPo', { defaultValue: 'Not on PO' })}</Badge>
        )}
      </div>
    );
  };

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
          <label className={fieldLabel}>
            {t('review.relatedPo', { defaultValue: 'Related PO' })}
          </label>
          <div className="mt-1" data-testid="invoice-review-po">
            <CustomDropdown
              options={poOptions}
              value={form.relatedPoId || undefined}
              onChange={(value) => update({ relatedPoId: value })}
              placeholder={t('review.selectPo', { defaultValue: 'Select purchase order' })}
              searchable
            />
          </div>
          {!form.relatedPoId &&
            extractedHint(
              matchResult && matchResult.poReferences.length > 0
                ? matchResult.poReferences.join(', ')
                : null,
            )}
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

      {/* ── PO match (FOR-293) ───────────────────────────────────────────── */}
      {matchBanner}

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
            <table className="w-full min-w-[960px] text-sm">
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
                  {/* Buyer-side accounting coding (FOR-295) */}
                  <th className="w-28 pb-2 pr-2 font-medium">
                    {t('review.line.costCode', { defaultValue: 'Cost code' })}
                  </th>
                  <th className="w-28 pb-2 pr-2 font-medium">
                    {t('review.line.glAccount', { defaultValue: 'GL account' })}
                  </th>
                  {showLineFlags && (
                    <th className="w-32 pb-2 pr-2 font-medium">
                      {t('review.line.poMatch', { defaultValue: 'PO match' })}
                    </th>
                  )}
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
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        value={line.costCode}
                        onChange={(e) => updateLine(line.key, { costCode: e.target.value })}
                        aria-label={t('review.line.costCode', { defaultValue: 'Cost code' })}
                      />
                    </td>
                    <td className="py-1.5 pr-2 align-top">
                      <Input
                        inputSize="sm"
                        value={line.glAccount}
                        onChange={(e) => updateLine(line.key, { glAccount: e.target.value })}
                        aria-label={t('review.line.glAccount', { defaultValue: 'GL account' })}
                      />
                    </td>
                    {showLineFlags && (
                      <td
                        className="py-1.5 pr-2 align-top pt-2.5"
                        data-testid={`invoice-review-line-match-${line.key}`}
                      >
                        {lineFlagBadges(line)}
                      </td>
                    )}
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

        {showLineFlags && dirty && (
          <p
            className="mt-2 text-xs text-muted-foreground"
            data-testid="invoice-review-match-stale"
          >
            {t('review.match.saveToRefresh', {
              defaultValue:
                'Variance flags are checked against the saved lines — save to refresh them.',
            })}
          </p>
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
