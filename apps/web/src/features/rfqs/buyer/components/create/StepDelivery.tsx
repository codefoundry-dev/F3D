import type { ProjectLocationResponse } from '@forethread/api-client';
import { Checkbox, CustomDropdown, DatePicker, FormField, Textarea } from '@forethread/ui-components';

const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'NZD'];

export interface DeliveryStepValues {
  deadlineEnd: string;
  deliveryLocationId: string;
  needByDate?: string;
  holdForRelease?: boolean;
  earliestDeliveryDate?: string;
  currency?: string;
  message?: string;
}

interface StepDeliveryProps {
  locations: ProjectLocationResponse[];
  values: DeliveryStepValues;
  onChange: (patch: Partial<DeliveryStepValues>) => void;
  errors?: Partial<Record<keyof DeliveryStepValues, string>>;
  locationsLoading?: boolean;
}

/** ISO datetime → YYYY-MM-DD for the DatePicker. */
function toDateInput(iso?: string): string {
  return iso ? iso.slice(0, 10) : '';
}

/** YYYY-MM-DD → ISO datetime (UTC midnight) for the schema (.datetime()). */
function toIso(date: string): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function StepDelivery({
  locations,
  values,
  onChange,
  errors,
  locationsLoading,
}: StepDeliveryProps) {
  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.label ? `${l.label} — ${l.address}` : l.address,
  }));
  const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Delivery &amp; specs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set the response deadline and delivery details.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Response deadline" error={errors?.deadlineEnd}>
          <DatePicker
            value={toDateInput(values.deadlineEnd)}
            minDate={today}
            onChange={(d) => onChange({ deadlineEnd: toIso(d) ?? '' })}
          />
        </FormField>

        <FormField label="Delivery location" error={errors?.deliveryLocationId}>
          <CustomDropdown
            options={locationOptions}
            value={values.deliveryLocationId}
            onChange={(v) => onChange({ deliveryLocationId: v })}
            placeholder={locationsLoading ? 'Loading…' : 'Select a delivery location'}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Need-by date (optional)">
          <DatePicker
            value={toDateInput(values.needByDate)}
            minDate={today}
            onChange={(d) => onChange({ needByDate: toIso(d) })}
          />
        </FormField>

        <FormField label="Currency (optional)">
          <CustomDropdown
            options={currencyOptions}
            value={values.currency ?? ''}
            onChange={(v) => onChange({ currency: v || undefined })}
            placeholder="Select a currency"
          />
        </FormField>
      </div>

      <div className="space-y-4">
        <Checkbox
          checked={values.holdForRelease ?? false}
          onChange={(checked) =>
            onChange({
              holdForRelease: checked,
              earliestDeliveryDate: checked ? values.earliestDeliveryDate : undefined,
            })
          }
          label="Hold for release"
        />

        {values.holdForRelease && (
          <FormField label="Earliest delivery date" error={errors?.earliestDeliveryDate}>
            <DatePicker
              value={toDateInput(values.earliestDeliveryDate)}
              minDate={today}
              onChange={(d) => onChange({ earliestDeliveryDate: toIso(d) })}
            />
          </FormField>
        )}
      </div>

      <FormField label="Message to vendors (optional)">
        <Textarea
          rows={3}
          value={values.message ?? ''}
          onChange={(e) => onChange({ message: e.target.value || undefined })}
          placeholder="Add any notes for the vendors"
        />
      </FormField>
    </section>
  );
}
