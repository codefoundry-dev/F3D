/**
 * Client-side draft state for the Create-RFQ wizard (US 5.05).
 *
 * The wizard persists slices of this state to the server between steps
 * (save-as-you-go drafts), so every type here is UI-shaped: dates are
 * YYYY-MM-DD strings, quantities are numbers, and rows carry a stable
 * client `key` so list edits never re-key React state.
 */

/** Where a draft line item originated. String union (not the shared-types
 * enum) so this module never drags the swagger-laden root barrel into Vite. */
export type WizardLineItemSource = 'CATALOG' | 'BOM' | 'MATERIAL_LIST';

export interface WizardLineItem {
  /** Stable client identity for React state. */
  key: string;
  /** Server line-item id, present once the draft has been persisted. */
  serverId?: string;
  source: WizardLineItemSource;
  /** Catalogue material id — present for CATALOG / MATERIAL_LIST lines and
   * for BOM lines that were matched to the catalogue. */
  materialId?: string;
  materialName: string;
  description?: string;
  quantity: number;
  uom: string;
  /** Project this row belongs to — one of the wizard's selected projects. */
  projectId?: string;
  deliveryLocationId?: string;
  /** YYYY-MM-DD */
  expectedDeliveryDate?: string;
  notes?: string;
}

export interface WizardBasicInfo {
  documentName: string;
  /** YYYY-MM-DD */
  responseDeadline: string;
  /** Selected project ids; the first is the primary project. */
  projectIds: string[];
  /** Selected delivery location ids (union across selected projects);
   * the first is persisted as the RFQ-level delivery location. */
  deliveryLocationIds: string[];
  /** YYYY-MM-DD */
  needByDate: string;
  isPickUp: boolean;
  pickUpLocation: string;
  holdForRelease: boolean;
  /** YYYY-MM-DD — required (and shown) only when holdForRelease. */
  earliestDeliveryDate: string;
}

export const EMPTY_BASIC_INFO: WizardBasicInfo = {
  documentName: '',
  responseDeadline: '',
  projectIds: [],
  deliveryLocationIds: [],
  needByDate: '',
  isPickUp: false,
  pickUpLocation: '',
  holdForRelease: false,
  earliestDeliveryDate: '',
};

/** Seed handed over by the "Converting a project BOM" / "Create from material
 * list" entry modals via router state. */
export interface WizardSeed {
  source: 'BOM' | 'MATERIAL_LIST';
  /** Projects implied by the seed (BOM flow) — locked in step 1. */
  projectIds?: string[];
  items: Array<
    Pick<WizardLineItem, 'source' | 'materialId' | 'materialName' | 'description'> & {
      quantity: number;
      uom: string;
      projectId?: string;
    }
  >;
}

let keyCounter = 0;
/** Monotonic client key — index-free so row removal never re-keys siblings. */
export function nextLineKey(): string {
  keyCounter += 1;
  return `li-${keyCounter}`;
}

export interface WizardFieldErrors {
  documentName?: string;
  responseDeadline?: string;
  projectIds?: string;
  deliveryLocationIds?: string;
  pickUpLocation?: string;
  earliestDeliveryDate?: string;
  vendorIds?: string;
  lineItems?: string;
}

/** Validate the Basic Information step (design: all * fields). */
export function validateBasicInfo(
  values: WizardBasicInfo,
  vendorIds: string[],
): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  if (!values.documentName.trim()) errors.documentName = 'required';
  if (!values.responseDeadline) errors.responseDeadline = 'required';
  if (values.projectIds.length === 0) errors.projectIds = 'required';
  if (values.isPickUp) {
    if (!values.pickUpLocation.trim()) errors.pickUpLocation = 'required';
  } else if (values.deliveryLocationIds.length === 0) {
    errors.deliveryLocationIds = 'required';
  }
  if (values.holdForRelease && !values.earliestDeliveryDate) {
    errors.earliestDeliveryDate = 'required';
  }
  if (vendorIds.length === 0) errors.vendorIds = 'atLeastOneVendor';
  return errors;
}

/** Validate the Add Line Items step. */
export function validateLineItems(items: WizardLineItem[]): WizardFieldErrors {
  const errors: WizardFieldErrors = {};
  if (items.length === 0) {
    errors.lineItems = 'atLeastOneItem';
    return errors;
  }
  const invalid = items.some(
    (item) => !item.materialName.trim() || item.quantity < 0.01 || !item.uom.trim(),
  );
  if (invalid) errors.lineItems = 'incompleteRows';
  return errors;
}
