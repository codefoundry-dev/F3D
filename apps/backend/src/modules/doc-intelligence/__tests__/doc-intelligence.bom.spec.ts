import {
  canonicalizeUnit,
  normalizeBomResult,
  parseNumber,
} from '../doc-intelligence.bom';

describe('parseNumber', () => {
  it.each([
    ['12', 12],
    ['12.5', 12.5],
    [12, 12],
    [0, 0],
    ['1,250.00', 1250],
    ['1.250,00', 1250],
    ['$1,250.50', 1250.5],
    ['1,250', 1250],
    ['1,5', 1.5],
    ['12 ea', 12],
    ['  3 ', 3],
  ])('parses %p → %p', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'abc', '-5', NaN, Infinity])(
    'returns null for invalid input %p',
    (input) => {
      expect(parseNumber(input as unknown as number)).toBeNull();
    },
  );
});

describe('canonicalizeUnit', () => {
  it.each([
    ['EA', 'ea'],
    ['Each', 'ea'],
    ['pcs', 'ea'],
    ['m2', 'm2'],
    ['SQM', 'm2'],
    ['m³', 'm3'],
    ['LM', 'm'],
    ['kgs', 'kg'],
    ['Ton', 't'],
    ['bags', 'bag'],
    ['Ea.', 'ea'],
  ])('maps %p → %p', (input, expected) => {
    expect(canonicalizeUnit(input)).toBe(expected);
  });

  it('passes unknown units through lowercased', () => {
    expect(canonicalizeUnit('CARTON')).toBe('carton');
  });

  it('returns null for empty / null input', () => {
    expect(canonicalizeUnit(null)).toBeNull();
    expect(canonicalizeUnit(undefined)).toBeNull();
    expect(canonicalizeUnit('   ')).toBeNull();
  });
});

describe('normalizeBomResult', () => {
  it('returns the empty BOM result when input is not an object', () => {
    expect(normalizeBomResult(null)).toMatchObject({ items: [] });
    expect(normalizeBomResult('nope')).toMatchObject({ items: [] });
    expect(normalizeBomResult(42)).toMatchObject({ items: [] });
  });

  it('extracts the canonical BOM shape and normalizes each row', () => {
    const result = normalizeBomResult({
      title: '  Tower 5 BOM ',
      projectName: ' Tower 5 ',
      currency: 'aud',
      items: [
        {
          description: 'Cement 25kg bag',
          quantity: '50',
          unit: 'BAGS',
          targetPrice: '$12.50',
          notes: '',
        },
        {
          description: 'Rebar #4',
          qty: '1,200',
          uom: 'LM',
          unitPrice: '2,15',
          remarks: ' grade 60 ',
        },
      ],
      notes: ' includes pickup ',
    });

    expect(result.title).toBe('Tower 5 BOM');
    expect(result.projectName).toBe('Tower 5');
    expect(result.currency).toBe('AUD');
    expect(result.notes).toBe('includes pickup');
    expect(result.items).toEqual([
      {
        description: 'Cement 25kg bag',
        quantity: 50,
        unit: 'bag',
        targetPrice: 12.5,
        notes: null,
      },
      {
        description: 'Rebar #4',
        quantity: 1200,
        unit: 'm',
        targetPrice: 2.15,
        notes: 'grade 60',
      },
    ]);
  });

  it('drops rows that have neither description nor quantity', () => {
    const result = normalizeBomResult({
      items: [
        { description: 'Real item', quantity: 1 },
        { description: '', quantity: null },
        { description: '   ', quantity: '' },
        null,
        { description: 'No qty is fine', quantity: null },
      ],
    });
    expect(result.items.map((i) => i.description)).toEqual(['Real item', 'No qty is fine']);
  });

  it('reads from `lineItems` when `items` is absent', () => {
    const result = normalizeBomResult({
      lineItems: [{ description: 'X', quantity: 2 }],
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('X');
  });

  it('always returns a non-null items array', () => {
    expect(normalizeBomResult({ title: 'no items here' }).items).toEqual([]);
  });
});
