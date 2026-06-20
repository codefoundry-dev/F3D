import { describe, expect, it } from 'vitest';

import {
  ALL_SPECIFIC_DATA_KEYS,
  ALL_SPECIFIC_SCHEMAS,
  DEFAULT_SPECIFIC_SCHEMA,
  resolveSpecificSchema,
  specificDataLabel,
} from './specificDataSchema';

describe('resolveSpecificSchema', () => {
  it('maps a plumbing category to the piping field set (incl. a Connection type dropdown)', () => {
    const schema = resolveSpecificSchema('Plumbing & Drainage');
    expect(schema.id).toBe('plumbing');
    expect(schema.fields.map((f) => f.key)).toEqual([
      'pressureRating',
      'wallThicknessSchedule',
      'temperatureResistance',
      'connectionType',
    ]);
    const connection = schema.fields.find((f) => f.key === 'connectionType');
    expect(connection?.type).toBe('select');
    expect(connection?.options).toContain('Threaded');
  });

  it('maps an electrical category to a DIFFERENT field set', () => {
    const schema = resolveSpecificSchema('Electrical Cables');
    expect(schema.id).toBe('electrical');
    expect(schema.fields.map((f) => f.key)).toEqual([
      'electricalRating',
      'ipRating',
      'insulationClass',
      'frequency',
    ]);
    // None of the plumbing-specific attributes leak in.
    expect(schema.fields.some((f) => f.key === 'connectionType')).toBe(false);
  });

  it('maps a fire-protection category and exposes a boolean SDS field for adhesives', () => {
    expect(resolveSpecificSchema('Fire Protection Systems').id).toBe('fireProtection');

    const adhesives = resolveSpecificSchema('Adhesives & Sealants');
    expect(adhesives.id).toBe('adhesives');
    expect(adhesives.fields.find((f) => f.key === 'sdsRequired')?.type).toBe('boolean');
  });

  it('is case-insensitive and matches on a substring keyword', () => {
    expect(resolveSpecificSchema('ELECTRICAL').id).toBe('electrical');
    expect(resolveSpecificSchema('Internal Wall Insulation').id).toBe('insulation');
  });

  it('falls back to the default (concrete / structural) set for unmatched or empty names', () => {
    // "Roofing" matches no keyword → default; this is relied on by the
    // create/edit page tests (compressiveStrength stays a typeable field).
    expect(resolveSpecificSchema('Roofing').id).toBe(DEFAULT_SPECIFIC_SCHEMA.id);
    expect(resolveSpecificSchema('Construction Materials').id).toBe('concrete');
    expect(resolveSpecificSchema('').id).toBe('concrete');
    expect(resolveSpecificSchema(undefined).id).toBe('concrete');
    expect(resolveSpecificSchema(null).id).toBe('concrete');
    expect(DEFAULT_SPECIFIC_SCHEMA.fields.map((f) => f.key)).toEqual([
      'compressiveStrength',
      'tensileStrength',
      'fireRating',
      'density',
    ]);
  });
});

describe('ALL_SPECIFIC_DATA_KEYS', () => {
  it('is the union of every field key across all schemas', () => {
    for (const schema of ALL_SPECIFIC_SCHEMAS) {
      for (const field of schema.fields) {
        expect(ALL_SPECIFIC_DATA_KEYS.has(field.key)).toBe(true);
      }
    }
    expect(ALL_SPECIFIC_DATA_KEYS.has('connectionType')).toBe(true);
    expect(ALL_SPECIFIC_DATA_KEYS.has('ipRating')).toBe(true);
    // A truly-custom (e.g. imported) key is NOT owned by any schema, so the
    // reconcile logic in AdditionalPropertiesFields preserves it.
    expect(ALL_SPECIFIC_DATA_KEYS.has('someImportedAttribute')).toBe(false);
  });
});

describe('specificDataLabel', () => {
  it('uses acronym-aware overrides, else humanizes the key', () => {
    expect(specificDataLabel('ipRating')).toBe('IP rating');
    expect(specificDataLabel('sdsRequired')).toBe('SDS required');
    expect(specificDataLabel('compressiveStrength')).toBe('Compressive strength');
    expect(specificDataLabel('connectionType')).toBe('Connection type');
  });
});
