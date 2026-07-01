import { CustomDropdown } from '@forethread/ui-components';

export interface FacetFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
  options: { value: string; label: string }[];
  /** Wrapper width/layout classes. Defaults to an auto-width filter-bar chip. */
  className?: string;
}

/**
 * A catalogue facet filter dropdown (category, manufacturer, UoM, material type,
 * country of origin). Wraps the shared searchable `CustomDropdown` so long facet
 * lists can be typed-to-filter instead of scrolled. Styled to match the DS
 * `Select` field so the filter bar keeps its look.
 *
 * The leading empty-value option restores the "all" state, mirroring the
 * previous native `<select>` placeholder option (so a selected facet can be
 * cleared). When a facet has no derived options the dropdown still renders
 * (placeholder only).
 */
export function FacetFilterSelect({
  value,
  onChange,
  placeholder,
  testId,
  options,
  className = 'w-auto min-w-[128px]',
}: FacetFilterSelectProps) {
  return (
    <div data-testid={testId} className={className}>
      <CustomDropdown
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        searchable
        searchPlaceholder={placeholder}
        options={[{ value: '', label: placeholder }, ...options]}
        triggerClassName="h-[34px] py-0 rounded-[12px] border-[#E8EAED] bg-white font-medium text-gray-900"
      />
    </div>
  );
}
