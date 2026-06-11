import { describe, expect, it } from 'vitest';

import {
  EMPTY_BASIC_INFO,
  nextLineKey,
  validateBasicInfo,
  validateLineItems,
  type WizardBasicInfo,
  type WizardLineItem,
} from './wizard-types';

const validInfo: WizardBasicInfo = {
  ...EMPTY_BASIC_INFO,
  documentName: 'Structural steel package',
  responseDeadline: '2026-07-01',
  projectIds: ['p1'],
  deliveryLocationIds: ['loc1'],
};

const vendor = ['v1'];

function item(overrides: Partial<WizardLineItem> = {}): WizardLineItem {
  return {
    key: nextLineKey(),
    source: 'CATALOG',
    materialName: 'Paint Primer White 5-Gal',
    quantity: 12,
    uom: 'gallons',
    ...overrides,
  };
}

describe('validateBasicInfo', () => {
  it('passes a complete delivery-order form', () => {
    expect(validateBasicInfo(validInfo, vendor)).toEqual({});
  });

  it('requires document name, deadline, project and a vendor', () => {
    const errors = validateBasicInfo(EMPTY_BASIC_INFO, []);
    expect(errors.documentName).toBeDefined();
    expect(errors.responseDeadline).toBeDefined();
    expect(errors.projectIds).toBeDefined();
    expect(errors.vendorIds).toBeDefined();
  });

  it('requires a delivery location only for delivery orders', () => {
    const errors = validateBasicInfo({ ...validInfo, deliveryLocationIds: [] }, vendor);
    expect(errors.deliveryLocationIds).toBeDefined();
  });

  it('swaps the location requirement to pick-up location for pick-up orders', () => {
    const pickUp = { ...validInfo, isPickUp: true, deliveryLocationIds: [] };
    expect(validateBasicInfo(pickUp, vendor).pickUpLocation).toBeDefined();
    expect(
      validateBasicInfo({ ...pickUp, pickUpLocation: 'Vendor yard, Detroit' }, vendor),
    ).toEqual({});
  });

  it('requires the earliest allowed delivery date only when holding for release', () => {
    const hold = { ...validInfo, holdForRelease: true };
    expect(validateBasicInfo(hold, vendor).earliestDeliveryDate).toBeDefined();
    expect(
      validateBasicInfo({ ...hold, earliestDeliveryDate: '2026-08-01' }, vendor),
    ).toEqual({});
  });
});

describe('validateLineItems', () => {
  it('requires at least one line item', () => {
    expect(validateLineItems([]).lineItems).toBe('atLeastOneItem');
  });

  it('flags rows missing a name, quantity or UoM', () => {
    expect(validateLineItems([item({ materialName: '  ' })]).lineItems).toBe('incompleteRows');
    expect(validateLineItems([item({ quantity: 0 })]).lineItems).toBe('incompleteRows');
    expect(validateLineItems([item({ uom: '' })]).lineItems).toBe('incompleteRows');
  });

  it('passes complete rows', () => {
    expect(validateLineItems([item(), item({ quantity: 0.5 })])).toEqual({});
  });
});

describe('nextLineKey', () => {
  it('issues unique keys', () => {
    expect(nextLineKey()).not.toBe(nextLineKey());
  });
});
