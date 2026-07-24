import { Textarea } from '@forethread/ui-components';

export interface ChangeReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  hint: string;
  placeholder: string;
}

/**
 * Optional "reason for change" note shown on the edit pages when a Company-Admin /
 * Procurement-Officer edits a PUBLIC catalogue material (US 4.01 Phase 3). The edit
 * is captured as a change request; this note explains WHY and is surfaced to the
 * reviewer on the pending diff card.
 */
export function ChangeReasonField({
  value,
  onChange,
  label,
  hint,
  placeholder,
}: ChangeReasonFieldProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="change-reason-field">
      <label htmlFor="material-change-reason" className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      <Textarea
        id="material-change-reason"
        className="mt-3"
        rows={3}
        maxLength={500}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        data-testid="change-reason-input"
      />
    </div>
  );
}
