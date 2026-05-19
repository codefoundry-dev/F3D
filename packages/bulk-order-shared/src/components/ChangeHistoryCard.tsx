import type { BulkOrderChangeRequest } from '@forethread/api-client';
import { useTranslation } from '@forethread/i18n';
import {
  formatDate,
  formatCurrency,
  CHANGE_REQUEST_STATUS_COLORS,
} from '@forethread/ui-components';

interface ChangeTag {
  label: string;
}

interface LineItemLookup {
  lineItemId: string;
  itemReference: string;
  description?: string;
  pricePerUnit: number;
  qty: number;
}

function parseChangeTags(
  changes: Record<string, unknown>,
  t: (key: string, opts?: Record<string, string>) => string,
  compact: boolean,
  currentEndDate?: string | null,
  lineItemsLookup?: LineItemLookup[],
): ChangeTag[] {
  const tags: ChangeTag[] = [];
  const placeholder = '...';

  if (changes.endDate) {
    const fromDate = !compact && currentEndDate ? formatDate(currentEndDate) : placeholder;
    tags.push({
      label: t('changeRequests.endDateChange', {
        from: fromDate,
        to: formatDate(changes.endDate as string),
      }),
    });
  }

  const lineItems = changes.lineItems as
    | Array<{
        action: string;
        lineItemId?: string;
        itemReference?: string;
        description?: string;
        unitPrice?: number;
        quantity?: number;
      }>
    | undefined;

  if (lineItems?.length) {
    for (const li of lineItems) {
      const lookup =
        li.lineItemId && lineItemsLookup
          ? lineItemsLookup.find((l) => l.lineItemId === li.lineItemId)
          : undefined;
      const name = li.itemReference || lookup?.itemReference || li.description || 'Item';

      if (li.action === 'remove') {
        tags.push({ label: t('changeRequests.itemRemoved', { item: name }) });
      } else if (li.action === 'add') {
        tags.push({ label: t('changeRequests.itemAdded', { item: name }) });
      } else if (li.action === 'update') {
        if (li.unitPrice !== undefined) {
          const fromPrice = !compact && lookup ? formatCurrency(lookup.pricePerUnit) : placeholder;
          tags.push({
            label: t('changeRequests.priceChange', {
              item: name,
              from: fromPrice,
              to: formatCurrency(li.unitPrice),
            }),
          });
        }
        if (li.quantity !== undefined) {
          const fromQty = !compact && lookup ? String(lookup.qty) : placeholder;
          tags.push({
            label: t('changeRequests.qtyChange', {
              item: name,
              from: fromQty,
              to: String(li.quantity),
            }),
          });
        }
      }
    }
  }

  return tags;
}

export interface ChangeHistoryCardProps {
  changeRequest: BulkOrderChangeRequest;
  isInitialVersion?: boolean;
  version?: number;
  rfqReference?: string | null;
  /** True when rendered inside the vendor app — flips approval labels */
  isVendorView?: boolean;
  /** When true, abbreviates "from" values with "..." (used in sidebar). Default: false */
  compact?: boolean;
  /** Current bulk order end date — used to resolve "from" values when not compact */
  currentEndDate?: string | null;
  /** Current line items — used to resolve "from" values when not compact */
  lineItems?: LineItemLookup[];
  /** When provided, shown as bold title instead of "Version X — Status" (used on list page) */
  bulkOrderTitle?: string;
}

export function ChangeHistoryCard({
  changeRequest,
  isInitialVersion = false,
  version,
  rfqReference,
  isVendorView = false,
  compact = false,
  currentEndDate,
  lineItems: lineItemsLookup,
  bulkOrderTitle,
}: ChangeHistoryCardProps) {
  const { t: _t } = useTranslation('bulkOrders');
  const t = _t as (key: string, opts?: Record<string, unknown>) => string;

  const colors =
    CHANGE_REQUEST_STATUS_COLORS[changeRequest.status] ?? CHANGE_REQUEST_STATUS_COLORS.APPROVED;
  const statusDot = colors.dot;

  let title: string;
  if (isInitialVersion) {
    title = t('changeRequests.activeVersion', { version: String(version ?? 1) });
  } else if (changeRequest.status === 'PENDING') {
    title = t('changeRequests.pendingVersion', { version: String(version ?? 2) });
  } else if (changeRequest.status === 'APPROVED') {
    title = t('changeRequests.approvedVersion', { version: String(version ?? 2) });
  } else {
    title = t('changeRequests.rejectedVersion');
  }

  const subtitle = isInitialVersion
    ? [
        t('changeRequests.createdBy', {
          name: changeRequest.requestedBy.name,
          date: formatDate(changeRequest.createdAt),
        }),
        rfqReference ? t('changeRequests.fromRfq', { rfqId: rfqReference }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : [
        t('changeRequests.proposedBy', {
          name: changeRequest.requestedBy.name,
          date: formatDate(changeRequest.createdAt),
        }),
        changeRequest.status === 'PENDING'
          ? t(
              isVendorView
                ? 'changeRequests.awaitingContractorApproval'
                : 'changeRequests.awaitingApproval',
            )
          : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const tags = isInitialVersion
    ? [{ label: t('changeRequests.initialAgreement') }]
    : parseChangeTags(changeRequest.changes, t, compact, currentEndDate, lineItemsLookup);

  return (
    <div className="bg-muted p-3">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full shrink-0 ${statusDot}`} />
          <span className="text-sm font-semibold text-foreground">{bulkOrderTitle ?? title}</span>
        </div>

        <p className="text-sm text-muted-foreground">{subtitle}</p>

        {changeRequest.status === 'REJECTED' && changeRequest.reason && (
          <p className="text-sm text-destructive">{changeRequest.reason}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-full bg-foreground/15 px-2 py-0.5 text-sm text-foreground"
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
