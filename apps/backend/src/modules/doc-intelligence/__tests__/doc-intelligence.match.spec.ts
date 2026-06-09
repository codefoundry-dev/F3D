import type { BomExtractionResult, BomLineItem } from '@forethread/shared-types';

import { normalizeBomResult } from '../doc-intelligence.bom';
import {
  annotateBomWithMatches,
  dropUnmatchedBomLines,
  matchLineToCatalogue,
  tokenize,
  tokenSimilarity,
  type CatalogueMaterial,
} from '../doc-intelligence.match';

const CATALOGUE: CatalogueMaterial[] = [
  { id: 'm-rebar', name: 'Steel Rebar 12mm' },
  { id: 'm-concrete40', name: 'Concrete Mix Grade 40' },
  { id: 'm-concrete30', name: 'Concrete Mix Grade 30' },
  { id: 'm-cement', name: 'Cement Bag 50kg' },
  { id: 'm-plywood', name: 'Plywood Sheet 18mm' },
];

describe('tokenize', () => {
  it('lowercases, strips punctuation, and drops single-char tokens', () => {
    expect(tokenize('Steel-Rebar, 12mm (A)')).toEqual(['steel', 'rebar', '12mm']);
  });

  it('returns an empty array for punctuation-only / empty input', () => {
    expect(tokenize('  -- . ')).toEqual([]);
    expect(tokenize('')).toEqual([]);
  });
});

describe('tokenSimilarity', () => {
  it('scores identical descriptions as 1', () => {
    expect(tokenSimilarity('Steel Rebar 12mm', 'Steel Rebar 12mm')).toBe(1);
  });

  it('is order- and case-insensitive', () => {
    expect(tokenSimilarity('12MM steel rebar', 'Steel Rebar 12mm')).toBe(1);
  });

  it('scores disjoint descriptions as 0', () => {
    expect(tokenSimilarity('Gravel 20mm', 'Steel Rebar 12mm')).toBe(0);
  });

  it('returns 0 when either side has no usable tokens', () => {
    expect(tokenSimilarity('', 'Steel Rebar 12mm')).toBe(0);
    expect(tokenSimilarity('a', 'Steel Rebar 12mm')).toBe(0);
  });

  it('penalises length mismatch (Dice, not overlap coefficient)', () => {
    // A bare "cement" against "Cement Bag 50kg": overlap-coefficient would be
    // 1.0; Dice is 2*1/(1+3) = 0.5, which keeps it below the auto-match bar.
    expect(tokenSimilarity('Cement', 'Cement Bag 50kg')).toBeCloseTo(0.5, 5);
  });
});

describe('matchLineToCatalogue', () => {
  it('auto-matches an exact description with confidence 1', () => {
    const match = matchLineToCatalogue('Steel Rebar 12mm', CATALOGUE);
    expect(match.matchedMaterialId).toBe('m-rebar');
    expect(match.matchedMaterialName).toBe('Steel Rebar 12mm');
    expect(match.matchConfidence).toBe(1);
  });

  it('auto-matches a near description that clears the 0.85 threshold', () => {
    // tokens {steel,rebar,12mm,bar} vs {steel,rebar,12mm} → 2*3/(4+3) ≈ 0.86
    const match = matchLineToCatalogue('Steel Rebar 12mm Bar', CATALOGUE);
    expect(match.matchedMaterialId).toBe('m-rebar');
    expect(match.matchConfidence).toBeGreaterThanOrEqual(0.85);
  });

  it('does NOT auto-match below the threshold but still returns candidates', () => {
    // "Concrete Mix" → 0.67 against both grade variants: surfaced, not auto-matched.
    const match = matchLineToCatalogue('Concrete Mix', CATALOGUE);
    expect(match.matchedMaterialId).toBeNull();
    expect(match.matchConfidence).toBeNull();
    expect(match.matchCandidates?.map((c) => c.materialId)).toEqual([
      'm-concrete30',
      'm-concrete40',
    ]);
    expect(match.matchCandidates?.[0].confidence).toBeCloseTo(0.67, 2);
  });

  it('keeps a sub-threshold single candidate above the floor for manual review', () => {
    const match = matchLineToCatalogue('Cement', CATALOGUE);
    expect(match.matchedMaterialId).toBeNull();
    expect(match.matchCandidates).toEqual([
      { materialId: 'm-cement', name: 'Cement Bag 50kg', confidence: 0.5 },
    ]);
  });

  it('returns no candidates when nothing clears the floor', () => {
    const match = matchLineToCatalogue('Galvanised Gutter Bracket', CATALOGUE);
    expect(match.matchedMaterialId).toBeNull();
    expect(match.matchConfidence).toBeNull();
    expect(match.matchCandidates).toEqual([]);
  });

  it('treats an empty description as unmatched', () => {
    expect(matchLineToCatalogue('', CATALOGUE)).toEqual({
      matchedMaterialId: null,
      matchedMaterialName: null,
      matchConfidence: null,
      matchCandidates: [],
    });
  });

  it('caps candidates at three, best-first', () => {
    const noisy: CatalogueMaterial[] = [
      { id: 'a', name: 'Concrete Mix Grade 10' },
      { id: 'b', name: 'Concrete Mix Grade 20' },
      { id: 'c', name: 'Concrete Mix Grade 30' },
      { id: 'd', name: 'Concrete Mix Grade 40' },
      { id: 'e', name: 'Concrete Mix Grade 50' },
    ];
    const match = matchLineToCatalogue('Concrete Mix Grade', noisy);
    expect(match.matchCandidates).toHaveLength(3);
    // All score equally → deterministic tie-break by name.
    expect(match.matchCandidates?.map((c) => c.materialId)).toEqual(['a', 'b', 'c']);
  });
});

describe('annotateBomWithMatches', () => {
  const bom: BomExtractionResult = {
    title: 'Site BOM',
    projectName: 'Tower A',
    currency: 'AUD',
    notes: null,
    items: [
      { description: 'Steel Rebar 12mm', quantity: 100, unit: 't', targetPrice: null, notes: null },
      { description: 'Mystery widget', quantity: 5, unit: 'ea', targetPrice: null, notes: null },
    ],
  };

  it('annotates every line and preserves the original fields', () => {
    const result = annotateBomWithMatches(bom, CATALOGUE);
    expect(result.items[0]).toMatchObject({
      description: 'Steel Rebar 12mm',
      quantity: 100,
      unit: 't',
      matchedMaterialId: 'm-rebar',
      matchConfidence: 1,
    });
    expect(result.items[1]).toMatchObject({
      description: 'Mystery widget',
      matchedMaterialId: null,
      matchConfidence: null,
      matchCandidates: [],
    });
  });

  it('does not mutate the input BOM', () => {
    annotateBomWithMatches(bom, CATALOGUE);
    expect(bom.items[0]).not.toHaveProperty('matchedMaterialId');
  });

  it('returns the BOM unchanged when there are no items', () => {
    const empty: BomExtractionResult = { ...bom, items: [] };
    expect(annotateBomWithMatches(empty, CATALOGUE)).toBe(empty);
  });
});

describe('dropUnmatchedBomLines', () => {
  const matched = (id: string | null): BomLineItem => ({
    description: id ? `material ${id}` : 'unmatched line',
    quantity: 1,
    unit: 'ea',
    targetPrice: null,
    notes: null,
    matchedMaterialId: id,
    matchedMaterialName: id ? `Material ${id}` : null,
    matchConfidence: id ? 1 : null,
    matchCandidates: [],
  });

  const bom: BomExtractionResult = {
    title: 'Site BOM',
    projectName: 'Tower A',
    currency: 'AUD',
    notes: null,
    items: [matched('m-rebar'), matched(null), matched('m-cement')],
  };

  it('keeps matched lines and drops the ones still unmatched at proceed time', () => {
    const result = dropUnmatchedBomLines(bom);
    expect(result.items.map((i) => i.matchedMaterialId)).toEqual(['m-rebar', 'm-cement']);
  });

  it('treats a never-annotated line (no matchedMaterialId field) as unmatched', () => {
    const raw: BomExtractionResult = {
      ...bom,
      items: [{ description: 'raw line', quantity: 1, unit: 'ea', targetPrice: null, notes: null }],
    };
    expect(dropUnmatchedBomLines(raw).items).toEqual([]);
  });

  it('preserves metadata and does not mutate the input', () => {
    const result = dropUnmatchedBomLines(bom);
    expect(result).toMatchObject({ title: 'Site BOM', projectName: 'Tower A', currency: 'AUD' });
    expect(bom.items).toHaveLength(3);
  });

  it('returns the BOM unchanged when there are no items', () => {
    const empty: BomExtractionResult = { ...bom, items: [] };
    expect(dropUnmatchedBomLines(empty)).toBe(empty);
  });
});

describe('normalizeBomResult preserves catalogue-match fields', () => {
  it('round-trips an already-matched line without dropping match data', () => {
    const matched = {
      items: [
        {
          description: 'Steel Rebar 12mm',
          quantity: 100,
          unit: 't',
          targetPrice: null,
          notes: null,
          matchedMaterialId: 'm-rebar',
          matchedMaterialName: 'Steel Rebar 12mm',
          matchConfidence: 1,
          matchCandidates: [{ materialId: 'm-rebar', name: 'Steel Rebar 12mm', confidence: 1 }],
        },
      ],
    };
    const result = normalizeBomResult(matched);
    expect(result.items[0]).toMatchObject({
      matchedMaterialId: 'm-rebar',
      matchedMaterialName: 'Steel Rebar 12mm',
      matchConfidence: 1,
      matchCandidates: [{ materialId: 'm-rebar', name: 'Steel Rebar 12mm', confidence: 1 }],
    });
  });
});
