import { describe, it, expect } from 'vitest';

import {
  buildCreateInput,
  composeLineNotes,
  hasDetailsErrors,
  nextLineKey,
  priorityToToggle,
  toggleToPriority,
  validateDetails,
  validateSelection,
  type MrWizardLine,
} from './wizard-types';

function makeLine(overrides: Partial<MrWizardLine> = {}): MrWizardLine {
  return {
    key: nextLineKey(),
    source: 'CATALOG',
    materialId: 'mat-1',
    materialName: 'Steel Rebar #4',
    unit: 'Each',
    quantity: 10,
    priority: 'STANDARD',
    expectedDeliveryDate: '2026-07-01',
    deliveryTime: '09:00',
    deliveryLocationId: 'loc-1',
    ...overrides,
  };
}

describe('nextLineKey', () => {
  it('returns unique, monotonic keys', () => {
    const a = nextLineKey();
    const b = nextLineKey();
    expect(a).not.toEqual(b);
  });
});

describe('toggleToPriority / priorityToToggle', () => {
  it('maps Standard → MEDIUM and High → HIGH', () => {
    expect(toggleToPriority('STANDARD')).toBe('MEDIUM');
    expect(toggleToPriority('HIGH')).toBe('HIGH');
  });

  it('maps API priorities back to the toggle (URGENT counts as High)', () => {
    expect(priorityToToggle('MEDIUM')).toBe('STANDARD');
    expect(priorityToToggle('LOW')).toBe('STANDARD');
    expect(priorityToToggle('HIGH')).toBe('HIGH');
    expect(priorityToToggle('URGENT')).toBe('HIGH');
    expect(priorityToToggle(null)).toBe('STANDARD');
  });
});

describe('validateSelection', () => {
  it('requires at least one line', () => {
    expect(validateSelection([])).toBe(false);
    expect(validateSelection([makeLine()])).toBe(true);
  });
});

describe('validateDetails', () => {
  it('passes for a fully filled line', () => {
    const errors = validateDetails([makeLine()]);
    expect(hasDetailsErrors(errors)).toBe(false);
  });

  it('flags a missing quantity', () => {
    const line = makeLine({ quantity: 0 });
    const errors = validateDetails([line]);
    expect(errors[line.key].quantity).toBe('required');
  });

  it('flags a quantity over the available stock', () => {
    const line = makeLine({ quantity: 99, maxAvailable: 47 });
    const errors = validateDetails([line]);
    expect(errors[line.key].quantity).toBe('exceedsStock');
  });

  it('allows a quantity at exactly the stock ceiling', () => {
    const line = makeLine({ quantity: 47, maxAvailable: 47 });
    const errors = validateDetails([line]);
    expect(errors[line.key]?.quantity).toBeUndefined();
  });

  it('flags missing need-by date, delivery time and delivery location', () => {
    const line = makeLine({
      expectedDeliveryDate: undefined,
      deliveryTime: '',
      deliveryLocationId: undefined,
    });
    const errors = validateDetails([line]);
    expect(errors[line.key].expectedDeliveryDate).toBe('required');
    expect(errors[line.key].deliveryTime).toBe('required');
    expect(errors[line.key].deliveryLocationId).toBe('required');
  });

  it('only reports lines that have errors', () => {
    const good = makeLine();
    const bad = makeLine({ quantity: 0 });
    const errors = validateDetails([good, bad]);
    expect(errors[good.key]).toBeUndefined();
    expect(errors[bad.key]).toBeDefined();
  });
});

describe('composeLineNotes', () => {
  it('joins instructions, internal notes, delivery time and CC', () => {
    const notes = composeLineNotes(
      makeLine({
        instructions: 'Deliver to gate B',
        internalNotes: 'Foreman: Joe',
        deliveryTime: '09:30',
        ccTeamMembers: ['Jane Doe'],
      }),
    );
    expect(notes).toContain('Deliver to gate B');
    expect(notes).toContain('Internal: Foreman: Joe');
    expect(notes).toContain('Delivery time: 09:30');
    expect(notes).toContain('CC: Jane Doe');
  });

  it('returns undefined when there is nothing to note', () => {
    const notes = composeLineNotes(
      makeLine({ instructions: '', internalNotes: '', deliveryTime: '', ccTeamMembers: [] }),
    );
    expect(notes).toBeUndefined();
  });
});

describe('buildCreateInput', () => {
  it('builds a submit payload from catalogue + manual lines', () => {
    const catalogLine = makeLine({ materialId: 'mat-1', quantity: 50, priority: 'HIGH' });
    const manualLine = makeLine({
      source: 'MANUAL',
      materialId: undefined,
      materialName: 'Custom bracket',
      quantity: 5,
      priority: 'STANDARD',
    });

    const input = buildCreateInput(
      { projectId: 'proj-1', lines: [catalogLine, manualLine] },
      { submit: true },
    );

    expect(input.projectId).toBe('proj-1');
    expect(input.submit).toBe(true);
    expect(input.lineItems).toHaveLength(2);
    // Request priority is HIGH because at least one line is High.
    expect(input.priority).toBe('HIGH');
    // Catalogue line carries materialId, manual line carries materialName.
    expect(input.lineItems[0].materialId).toBe('mat-1');
    expect(input.lineItems[0].materialName).toBeUndefined();
    expect(input.lineItems[1].materialName).toBe('Custom bracket');
    expect(input.lineItems[1].materialId).toBeUndefined();
  });

  it('maps each line priority via the toggle', () => {
    const input = buildCreateInput({
      projectId: 'p',
      lines: [makeLine({ priority: 'STANDARD' }), makeLine({ priority: 'HIGH' })],
    });
    expect(input.lineItems[0].priority).toBe('MEDIUM');
    expect(input.lineItems[1].priority).toBe('HIGH');
  });

  it('defaults request priority to MEDIUM when no line is High', () => {
    const input = buildCreateInput({
      projectId: 'p',
      lines: [makeLine({ priority: 'STANDARD' })],
    });
    expect(input.priority).toBe('MEDIUM');
  });

  it('converts YYYY-MM-DD dates to ISO and carries the first line date/location to the header', () => {
    const input = buildCreateInput({
      projectId: 'p',
      lines: [makeLine({ expectedDeliveryDate: '2026-07-01', deliveryLocationId: 'loc-9' })],
    });
    expect(input.lineItems[0].expectedDeliveryDate).toBe('2026-07-01T00:00:00.000Z');
    expect(input.neededByDate).toBe('2026-07-01T00:00:00.000Z');
    expect(input.deliveryLocationId).toBe('loc-9');
  });

  it('honours submit:false for a draft', () => {
    const input = buildCreateInput({ projectId: 'p', lines: [makeLine()] }, { submit: false });
    expect(input.submit).toBe(false);
  });
});
