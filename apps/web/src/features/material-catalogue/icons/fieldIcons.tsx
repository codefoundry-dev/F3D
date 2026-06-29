import type { SVGProps } from 'react';

import * as P from './phosphor';

type IconCmp = (props: SVGProps<SVGSVGElement>) => JSX.Element;

/**
 * Material field → leading glyph, taken verbatim from the "Contribute to
 * material catalogue" Figma board (each input / read-only value is prefixed by
 * one of these Phosphor icons). Keyed by the `form.fields.*` key so the create
 * wizard, edit page, review summary and detail page all stay in lockstep.
 */
const FIELD_ICONS: Record<string, IconCmp> = {
  // Core identification
  name: P.CubeIcon,
  materialName: P.CubeIcon,
  category: P.SquaresFourIcon,
  categories: P.SquaresFourIcon,
  materialType: P.SubtractSquareIcon,
  uom: P.RulerIcon,
  unitOfMeasure: P.RulerIcon,
  itemType: P.NutIcon,
  manufacturer: P.FactoryIcon,
  seriesModel: P.TagSimpleIcon,
  mpn: P.CpuIcon,
  countryOfOrigin: P.GlobeHemisphereWestIcon,
  upc: P.BarcodeIcon,
  sku: P.TicketIcon,
  gradeClass: P.AsteriskIcon,
  standardNorm: P.CertificateIcon,
  colourFinish: P.PaletteIcon,
  size: P.BoundingBoxIcon,
  pricePerUnit: P.CoinsIcon,
  currency: P.CurrencyCircleDollarIcon,
  costCode: P.HashIcon,
  taxCode: P.HashIcon,
  description: P.TextAlignLeftIcon,
  // Dimensions
  length: P.RulerIcon,
  width: P.RulerIcon,
  height: P.RulerIcon,
  diameter: P.CircleIcon,
  thickness: P.RulerIcon,
  volume: P.CubeTransparentIcon,
  weightPerUnit: P.ScalesIcon,
  // Packaging & handling
  packagingUnit: P.ShoppingBagIcon,
  unitsPerPackage: P.PackageIcon,
  weightPerPackage: P.ScalesIcon,
  // Specific data (category-driven; the rest fall back to Sparkle)
  fireRating: P.FireIcon,
  density: P.CircleHalfTiltIcon,
  // Detail / review only
  internalId: P.ScanIcon,
  materialCode: P.HashIcon,
  status: P.SealCheckIcon,
  lastModified: P.ClockIcon,
};

export type MaterialFieldKey = keyof typeof FIELD_ICONS;

/**
 * Renders the leading icon for a material field. Unknown keys fall back to a
 * neutral Sparkle (used for the category-driven "Specific data" attributes,
 * whose set varies per category). Defaults to a 16px glyph.
 */
export function FieldIcon({ field, className = 'size-4' }: { field: string; className?: string }) {
  const Icon = FIELD_ICONS[field] ?? P.SparkleIcon;
  return <Icon className={className} />;
}
