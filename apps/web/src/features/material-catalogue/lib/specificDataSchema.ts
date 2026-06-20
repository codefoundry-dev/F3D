import { humanizeKey } from './format';

/**
 * Category-specific "Specific data" schemas (US 4.01).
 *
 * The "Edit Additional Properties" / create-wizard Step 2 form renders a
 * *category-driven* "Specific data" section: the visible attributes change with
 * the material's selected category. The nine field sets here are transcribed
 * from the Figma "Category specific data" A–I frames
 * (file CFA6k0XCvImOmWXbBgdWYZ, board node 5411:96868).
 *
 * Categories are free-form (Super-Admin creates them; only "Construction
 * Materials" is seeded), so we can't key on a fixed enum. Instead each schema
 * carries `keywords` matched (case-insensitive substring) against the category
 * name, and anything that doesn't match falls back to {@link CONCRETE_SCHEMA}
 * (the design's variant A — the four general structural attributes).
 *
 * Values are stored in the material's open-ended `properties` JSONB under the
 * stable camelCase `key` (never the human label), so a category rename or a
 * schema label tweak never strands stored data. No migration is needed — the
 * column already accepts arbitrary keys.
 */

export type SpecificFieldType = 'text' | 'select' | 'boolean';

export interface SpecificField {
  /** Stable key persisted in `properties` JSONB, e.g. `compressiveStrength`. */
  key: string;
  /** Human label shown in the form (may carry a unit hint, e.g. "(PN, PSI)"). */
  label: string;
  /** Input rendered: free text (default), a dropdown, or a Yes/No choice. */
  type: SpecificFieldType;
  /** Curated options for `type: 'select'` (the form also round-trips a stored
   *  value outside this list). */
  options?: readonly string[];
}

export interface CategorySpecificSchema {
  /** Stable schema id (NOT persisted) — used as the React reconcile key. */
  id: string;
  /** Human label for the schema (for docs / debugging; not rendered). */
  label: string;
  /** Case-insensitive substrings matched against the category name. */
  keywords: readonly string[];
  fields: readonly SpecificField[];
}

const text = (key: string, label: string): SpecificField => ({ key, label, type: 'text' });

// ── The nine category schemas (Figma variants A–I) ──────────────────────────

/** Variant A — the general structural set; also the fallback for any unmatched
 *  category (e.g. the seeded "Construction Materials"). */
const CONCRETE_SCHEMA: CategorySpecificSchema = {
  id: 'concrete',
  label: 'Concrete & structural',
  keywords: ['concrete', 'cement', 'aggregate', 'structural', 'masonry', 'rebar', 'reinforc'],
  fields: [
    // Shown as a dropdown in the design, but kept free-text: compressive
    // strength is an open measured value (e.g. "40 MPa"), not an enum.
    text('compressiveStrength', 'Compressive strength'),
    text('tensileStrength', 'Tensile strength'),
    text('fireRating', 'Fire rating'),
    text('density', 'Density'),
  ],
};

/** Variant B — plumbing / piping. */
const PLUMBING_SCHEMA: CategorySpecificSchema = {
  id: 'plumbing',
  label: 'Plumbing & piping',
  keywords: ['plumb', 'pipe', 'piping', 'valve', 'fitting', 'drain', 'sanitary', 'hydraulic'],
  fields: [
    text('pressureRating', 'Pressure rating (PN, PSI)'),
    text('wallThicknessSchedule', 'Wall thickness / schedule'),
    text('temperatureResistance', 'Temperature resistance'),
    {
      key: 'connectionType',
      label: 'Connection type',
      type: 'select',
      options: [
        'Threaded',
        'Push-fit',
        'Compression',
        'Solvent weld',
        'Soldered',
        'Flanged',
        'Welded',
        'Grooved',
        'Crimp',
      ],
    },
  ],
};

/** Variant C — electrical. */
const ELECTRICAL_SCHEMA: CategorySpecificSchema = {
  id: 'electrical',
  label: 'Electrical',
  keywords: ['electric', 'cable', 'wiring', 'conduit', 'switch', 'socket', 'lighting', 'luminaire'],
  fields: [
    text('electricalRating', 'Electrical rating'),
    text('ipRating', 'IP rating'),
    text('insulationClass', 'Insulation class'),
    text('frequency', 'Frequency'),
  ],
};

/** Variant D — HVAC / mechanical. */
const HVAC_SCHEMA: CategorySpecificSchema = {
  id: 'hvac',
  label: 'HVAC & mechanical',
  keywords: ['hvac', 'ventilat', 'air condition', 'air-condition', 'duct', 'refrigerat', 'chiller'],
  fields: [
    text('airflowCapacity', 'Airflow capacity'),
    text('pressureRating', 'Pressure rating'),
    text('temperatureRange', 'Temperature range'),
    text('energyEfficiencyClass', 'Energy efficiency class'),
    text('electricalRating', 'Electrical rating'),
    text('noiseLevel', 'Noise level'),
  ],
};

/** Variant E — fire protection. */
const FIRE_PROTECTION_SCHEMA: CategorySpecificSchema = {
  id: 'fireProtection',
  label: 'Fire protection',
  keywords: ['fire protection', 'fire safety', 'sprinkler', 'suppression', 'fire alarm', 'fire'],
  fields: [
    text('fireRating', 'Fire rating (minutes, class)'),
    text('activationTemperature', 'Activation temperature'),
    text('pressureRating', 'Pressure rating (for sprinklers)'),
    text('complianceStandard', 'Compliance standard'),
    text('certification', 'Certification'),
  ],
};

/** Variant F — insulation. */
const INSULATION_SCHEMA: CategorySpecificSchema = {
  id: 'insulation',
  label: 'Insulation',
  keywords: ['insulat', 'thermal', 'acoustic', 'soundproof', 'batt', 'lagging'],
  fields: [
    text('thermalResistance', 'Thermal resistance (R-value)'),
    text('fireRating', 'Fire rating'),
    text('acousticRating', 'Acoustic rating'),
    text('moistureResistance', 'Moisture resistance'),
  ],
};

/** Variant G — flooring & finishes. */
const FLOORING_SCHEMA: CategorySpecificSchema = {
  id: 'flooring',
  label: 'Flooring & finishes',
  keywords: [
    'floor',
    'tile',
    'carpet',
    'vinyl',
    'laminate',
    'finish',
    'coating',
    'paint',
    'render',
  ],
  fields: [
    text('finishType', 'Finish type'),
    text('wearClass', 'Wear class'),
    text('slipResistance', 'Slip resistance'),
    text('coverageRate', 'Coverage rate'),
    text('applicationMethod', 'Application method'),
  ],
};

/** Variant H — fasteners & hardware. */
const FASTENERS_SCHEMA: CategorySpecificSchema = {
  id: 'fasteners',
  label: 'Fasteners & hardware',
  keywords: [
    'fasten',
    'bolt',
    'screw',
    'nut',
    'washer',
    'anchor',
    'hardware',
    'fixing',
    'nail',
    'rivet',
  ],
  fields: [
    text('grade', 'Grade'),
    text('threadType', 'Thread type'),
    text('corrosionResistance', 'Corrosion resistance'),
    text('loadRating', 'Load rating'),
  ],
};

/** Variant I — adhesives & chemicals. */
const ADHESIVES_SCHEMA: CategorySpecificSchema = {
  id: 'adhesives',
  label: 'Adhesives & chemicals',
  keywords: [
    'adhesive',
    'sealant',
    'glue',
    'epoxy',
    'silicone',
    'grout',
    'mortar',
    'resin',
    'solvent',
    'caulk',
  ],
  fields: [
    text('chemicalType', 'Chemical type'),
    text('cureTime', 'Cure time'),
    text('applicationTemperature', 'Application temperature'),
    text('shelfLife', 'Shelf life'),
    text('hazardClassification', 'Hazard classification'),
    { key: 'sdsRequired', label: 'SDS required', type: 'boolean' },
  ],
};

/** The default / fallback schema when a category name matches no keywords. */
export const DEFAULT_SPECIFIC_SCHEMA = CONCRETE_SCHEMA;

/**
 * Schemas in match priority order (most specific first). Probed left-to-right;
 * the first whose keyword is a substring of the category name wins. `concrete`
 * is intentionally absent — it is the fallback (also covering "steel" /
 * "Construction Materials" style names that need the general structural set).
 */
const SCHEMA_MATCH_ORDER: readonly CategorySpecificSchema[] = [
  FIRE_PROTECTION_SCHEMA,
  PLUMBING_SCHEMA,
  ELECTRICAL_SCHEMA,
  HVAC_SCHEMA,
  INSULATION_SCHEMA,
  FASTENERS_SCHEMA,
  ADHESIVES_SCHEMA,
  FLOORING_SCHEMA,
];

/** Every schema, for tooling/tests (default first). */
export const ALL_SPECIFIC_SCHEMAS: readonly CategorySpecificSchema[] = [
  CONCRETE_SCHEMA,
  ...SCHEMA_MATCH_ORDER,
];

/**
 * The union of every key owned by *any* schema. Used to tell a category's own
 * attributes apart from truly-custom keys (e.g. bulk-imported ones) when
 * reconciling the form after a category change.
 */
export const ALL_SPECIFIC_DATA_KEYS: ReadonlySet<string> = new Set(
  ALL_SPECIFIC_SCHEMAS.flatMap((s) => s.fields.map((f) => f.key)),
);

/**
 * Resolve the "Specific data" schema for a category by name. Matches a keyword
 * (case-insensitive substring) against {@link SCHEMA_MATCH_ORDER}; falls back
 * to {@link DEFAULT_SPECIFIC_SCHEMA} when nothing matches (or no name yet).
 */
export function resolveSpecificSchema(categoryName?: string | null): CategorySpecificSchema {
  const name = (categoryName ?? '').toLowerCase().trim();
  if (name) {
    for (const schema of SCHEMA_MATCH_ORDER) {
      if (schema.keywords.some((keyword) => name.includes(keyword))) return schema;
    }
  }
  return DEFAULT_SPECIFIC_SCHEMA;
}

/** Clean display labels for keys whose camelCase doesn't humanize nicely. */
const DISPLAY_LABEL_OVERRIDES: Record<string, string> = {
  ipRating: 'IP rating',
  sdsRequired: 'SDS required',
};

/**
 * Human label for a stored `properties` key, for read-only views (detail /
 * review). Prefers an acronym-aware override, else derives one from the key —
 * deliberately schema-independent so it labels keys from any category (or
 * legacy/imported keys) consistently.
 */
export function specificDataLabel(key: string): string {
  return DISPLAY_LABEL_OVERRIDES[key] ?? humanizeKey(key);
}
