import type { VendorListItem } from '@forethread/api-client';
import { Checkbox } from '@forethread/ui-components';

interface StepVendorsProps {
  vendors: VendorListItem[];
  selectedIds: string[];
  onToggle: (vendorId: string, checked: boolean) => void;
  error?: string;
  isLoading?: boolean;
}

export function StepVendors({
  vendors,
  selectedIds,
  onToggle,
  error,
  isLoading,
}: StepVendorsProps) {
  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Vendors</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select at least one vendor to send this RFQ to.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vendors…</p>
      ) : vendors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assigned vendors found.</p>
      ) : (
        <div
          className="border border-input rounded-md p-3 flex flex-col gap-2 max-h-72 overflow-y-auto"
          data-testid="vendor-list"
        >
          {vendors.map((vendor) => (
            // Select by companyId, not vendor.id: vendor.id is the
            // CompanyVendorAssignment row id, but the RFQ stores/validates
            // invited vendors by their Company id (RfqVendor.vendorId →
            // Company.id). Submitting assignment ids fails the backend's
            // assertVendorsAssigned check with "Some vendor IDs are invalid".
            <Checkbox
              key={vendor.id}
              checked={selectedIds.includes(vendor.companyId)}
              onChange={(checked) => onToggle(vendor.companyId, checked)}
              label={vendor.companyName}
            />
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
