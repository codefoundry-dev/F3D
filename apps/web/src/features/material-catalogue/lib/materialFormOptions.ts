import { type DropdownOption } from '@forethread/ui-components';

/**
 * Curated dropdown option lists for the material create / edit forms (US 4.01
 * Phase 2). These are deliberately small, opinionated lists — most are
 * free-form-but-dropdown, so {@link withValue} appends any stored value that is
 * not already present (e.g. a material imported with a grade outside the
 * curated set) so editing never silently drops data.
 */

function toOptions(values: readonly string[]): DropdownOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

/**
 * Ensure `value` is present in `options`; if it is non-empty and missing,
 * append it so the dropdown can display (and round-trip) a stored value that
 * isn't part of the curated list. Returns the original array when nothing is
 * added.
 */
export function withValue(options: DropdownOption[], value?: string | null): DropdownOption[] {
  if (!value) return options;
  if (options.some((o) => o.value === value)) return options;
  return [...options, { value, label: value }];
}

export const currencyOptions: DropdownOption[] = toOptions(['AUD', 'USD', 'GBP', 'EUR', 'NZD']);

/**
 * Country list — Australia first (the platform's home market), then the major
 * trading partners and common origins for construction materials.
 */
export const countryOptions: DropdownOption[] = toOptions([
  'Australia',
  'New Zealand',
  'China',
  'United States',
  'United Kingdom',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Sweden',
  'Norway',
  'Finland',
  'Denmark',
  'Switzerland',
  'Austria',
  'Ireland',
  'Poland',
  'Portugal',
  'Japan',
  'South Korea',
  'India',
  'Indonesia',
  'Malaysia',
  'Singapore',
  'Thailand',
  'Vietnam',
  'Taiwan',
  'Philippines',
  'Canada',
  'Mexico',
  'Brazil',
  'Chile',
  'Argentina',
  'South Africa',
  'United Arab Emirates',
  'Saudi Arabia',
  'Turkey',
  'Czech Republic',
  'Other',
]);

/** General unit-of-measure list used by the "Unit of Measure" core field. */
export const uomOptions: DropdownOption[] = toOptions([
  'each',
  'box',
  'pack',
  'sheet',
  'roll',
  'bag',
  'pallet',
  'set',
  'pair',
  'm',
  'lm',
  'm²',
  'm³',
  'mm',
  'cm',
  'kg',
  'g',
  'tonne',
  'L',
  'mL',
]);

/** Length / linear dimensions (Length, Width, Height, Diameter, Thickness). */
export const lengthUomOptions: DropdownOption[] = toOptions(['mm', 'cm', 'm']);

/** Weight dimensions (Weight per unit). */
export const weightUomOptions: DropdownOption[] = toOptions(['g', 'kg', 'tonne']);

/** Volume dimension. */
export const volumeUomOptions: DropdownOption[] = toOptions(['mL', 'L', 'm³']);

/** Packaging unit (Packaging & Handling card). */
export const packagingUnitOptions: DropdownOption[] = toOptions([
  'box',
  'carton',
  'pallet',
  'bag',
  'crate',
  'bundle',
  'each',
]);

export const materialTypeOptions: DropdownOption[] = toOptions([
  'Aggregate',
  'Cement',
  'Concrete',
  'Steel',
  'Timber',
  'Insulation',
  'Roofing',
  'Cladding',
  'Plumbing',
  'Electrical',
  'Hardware',
  'Adhesive',
  'Coating',
  'Glass',
  'Masonry',
  'Plasterboard',
  'Flooring',
  'Other',
]);

export const itemTypeOptions: DropdownOption[] = toOptions([
  'Raw material',
  'Component',
  'Finished good',
  'Consumable',
  'Tool',
  'Fixture',
  'Fastener',
  'Other',
]);

export const gradeClassOptions: DropdownOption[] = toOptions([
  'C16',
  'C24',
  'C32',
  'C40',
  'GP',
  'HES',
  'N20',
  'N25',
  'N32',
  'N40',
  'Grade 250',
  'Grade 300',
  'Grade 500',
  'Class 1',
  'Class 2',
  'Class 3',
]);

export const standardNormOptions: DropdownOption[] = toOptions([
  'AS',
  'AS/NZS',
  'ASTM',
  'EN',
  'ISO',
  'BS',
  'DIN',
  'JIS',
]);

export const colourOptions: DropdownOption[] = toOptions([
  'White',
  'Black',
  'Grey',
  'Charcoal',
  'Silver',
  'Galvanised',
  'Zinc',
  'Red',
  'Green',
  'Blue',
  'Brown',
  'Beige',
  'Cream',
  'Natural',
  'Clear',
  'Matte',
  'Gloss',
  'Satin',
]);
