import type { ProjectLocationResponse, VendorListItem } from '@forethread/api-client';

import type { DeliveryStepValues } from './StepDelivery';
import type { RfqLineItemDraft } from './StepMaterials';

interface StepReviewProps {
  projectName: string;
  lineItems: RfqLineItemDraft[];
  vendors: VendorListItem[];
  selectedVendorIds: string[];
  delivery: DeliveryStepValues;
  locations: ProjectLocationResponse[];
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground text-right">{value}</dd>
    </div>
  );
}

export function StepReview({
  projectName,
  lineItems,
  vendors,
  selectedVendorIds,
  delivery,
  locations,
}: StepReviewProps) {
  const selectedVendors = vendors.filter((v) => selectedVendorIds.includes(v.id));
  const deliveryLocation = locations.find((l) => l.id === delivery.deliveryLocationId);
  const deliveryLocationLabel = deliveryLocation
    ? deliveryLocation.label
      ? `${deliveryLocation.label} — ${deliveryLocation.address}`
      : deliveryLocation.address
    : '—';

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Review</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review the request before saving it as a draft.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Project</h3>
        <dl className="border-t border-border">
          <Row label="Project" value={projectName || '—'} />
        </dl>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Materials ({lineItems.length})
        </h3>
        {lineItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No materials added.</p>
        ) : (
          <ul className="border-t border-border divide-y divide-border" data-testid="review-line-items">
            {lineItems.map((item, index) => (
              <li key={index} className="py-2">
                <p className="text-sm font-medium text-foreground">
                  {item.materialName}
                  {item.source === 'BOM' ? ' (BOM)' : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.quantity} {item.uom}
                  {item.costCode ? ` · ${item.costCode}` : ''}
                  {item.pickUp ? ' · Pick-up' : ''}
                </p>
                {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">
          Vendors ({selectedVendors.length})
        </h3>
        {selectedVendors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vendors selected.</p>
        ) : (
          <ul className="border-t border-border divide-y divide-border" data-testid="review-vendors">
            {selectedVendors.map((vendor) => (
              <li key={vendor.id} className="py-2 text-sm text-foreground">
                {vendor.companyName}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Delivery &amp; specs</h3>
        <dl className="border-t border-border">
          <Row label="Response deadline" value={formatDate(delivery.deadlineEnd)} />
          <Row label="Delivery location" value={deliveryLocationLabel} />
          <Row label="Need-by date" value={formatDate(delivery.needByDate)} />
          <Row label="Hold for release" value={delivery.holdForRelease ? 'Yes' : 'No'} />
          {delivery.holdForRelease && (
            <Row label="Earliest delivery date" value={formatDate(delivery.earliestDeliveryDate)} />
          )}
          <Row label="Currency" value={delivery.currency ?? '—'} />
          <Row label="Message" value={delivery.message ?? '—'} />
        </dl>
      </div>
    </section>
  );
}
