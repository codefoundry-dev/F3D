# API Contract: Purchase Orders

**Base path**: `/v1/purchase-orders` **Module**: `apps/backend/src/modules/purchase-orders/`
**Auth**: Required on all endpoints

---

## GET /v1/purchase-orders

List purchase orders. **Roles**: ProcurementOfficer, CompanyAdmin, FinancialOfficer (contractor);
Vendor (own POs only).

**Query params**:

```
page          integer (default 1)
limit         integer (default 25, max 100)
projectId     uuid
vendorId      uuid
status        PoStatus
type          PoType (STANDARD | BULK | HOLD_FOR_RELEASE | DRAWDOWN | SPLIT)
search        string (PO number, vendor name)
dateFrom      ISO-8601
dateTo        ISO-8601
sortBy        createdAt | expectedDelivery | status | totalValue
sortDir       asc | desc
```

**Response 200**: Paginated list of PO summaries.

---

## POST /v1/purchase-orders

Create a purchase order. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:

```json
{
  "projectId": "uuid (required)",
  "vendorId": "uuid (required)",
  "deliveryLocationId": "uuid (required, FK to ProjectLocation)",
  "plannedDeliveryDate": "ISO-8601 (required)",
  "poType": "PoType (default: STANDARD)",
  "sourceOfCreation": "PoSourceOfCreation (default: MANUAL)",
  "priority": "PoPriority (optional: LOW | MEDIUM | HIGH)",
  "holdForRelease": "boolean (optional, default false)",
  "deadlineStart": "ISO-8601 (required if holdForRelease: true — earliest delivery date)",
  "deadlineEnd": "ISO-8601 (optional)",
  "pickUp": "boolean (optional, default false)",
  "pickUpLocation": "string (optional, address if pickUp: true)",
  "pickUpTimeExpectation": "PickUpTimeExpectation (optional: ASAP | TOMORROW | CUSTOM_DATE)",
  "pickUpPersonName": "string (optional)",
  "pickUpPersonPhone": "string (optional)",
  "currency": "string (default: AUD)",
  "paymentTermsDays": "number (optional, days)",
  "costCode": "string (optional, from ERP)",
  "rfqId": "uuid (optional — link to source RFQ)",
  "deliveryNotes": "string (optional)",
  "message": "string (optional)",
  "deliveryResponsibleName": "string (optional)",
  "deliveryResponsibleEmail": "string (optional)",
  "lineItems": [
    {
      "materialId": "uuid (required, FK to Material catalogue)",
      "quantity": "number (required, > 0)",
      "uom": "string (required)",
      "unitPrice": "number (required)",
      "costCode": "string (optional, from ERP)",
      "materialCode": "string (optional)",
      "notes": "string (optional)",
      "expectedDeliveryDate": "ISO-8601 (optional, line-level override)",
      "deliveryLocationId": "uuid (optional, line-level override, FK to ProjectLocation)"
    }
  ],
  "attachments": ["file IDs (optional)"]
}
```

> **FRD US 5.05 AC 2**: Materials must come from the Material Catalogue. Users can manually enter a
> name and create a new catalogue entry on the fly (AC 2.2).

> **Constraint**: A directly-created PO (this endpoint) has exactly one vendor (`vendorId`) and one
> project (`projectId`). Multi-vendor awards are produced from the RFQ quote-review flow via
> `POST /v1/rfqs/:rfqId/award-split` (US 5.19), which mints a `SPLIT` parent PO owning one child PO
> per vendor — see below.

**Response 201**: Created PO with `status: Draft` and system-generated PO number.

**Business rules**:

- On creation, system checks line items against active bulk orders; returns `bulkSuggestions` in
  response for user confirmation.
- When `pickUp: true`, delivery location fields are set to null and labelled "Pick-up" in all views.

---

## POST /v1/purchase-orders/:id/issue

Issue (send) a draft PO to the vendor. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: PO updated to `status: SENT`; vendor notified.

---

## GET /v1/purchase-orders/:id

Get full PO details. **Roles**: Any user assigned to the PO's project (contractor); Vendor (own
POs).

**Response 200**: Full PO object with line items, vendor details, change history, and linked
delivery reports / invoices.

---

## PATCH /v1/purchase-orders/:id

Update a draft PO. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: Updated PO.

**Business rules**: Only `status: DRAFT` POs can be directly edited. For issued POs, use change
request flow.

---

## POST /v1/purchase-orders/:id/confirm (Vendor endpoint)

Vendor confirms receipt of an issued PO.

**Response 200**: PO updated to `status: ACKNOWLEDGED`.

---

## POST /v1/purchase-orders/:id/change-requests

Initiate a change request on an issued PO. **Roles**: ProcurementOfficer, CompanyAdmin, Vendor.

**Request body**:

```json
{
  "type": "PoChangeType (COMMERCIAL | INTERNAL, required)",
  "changes": [
    {
      "field": "string (field path, e.g. lineItems.0.unitPrice)",
      "currentValue": "any",
      "proposedValue": "any",
      "reason": "string (optional)"
    }
  ],
  "message": "string (optional)"
}
```

**Response 201**: Change request created with `status: Pending`.

**Business rules**:

- Commercial changes require other-party approval.
- Internal changes apply immediately on save.
- For closed POs, only internal changes are allowed.

---

## GET /v1/purchase-orders/:id/change-requests

List all change requests for a PO.

**Response 200**: Array of change requests with status, actor, and changed fields.

---

## PATCH /v1/purchase-orders/:id/change-requests/:crId/approve

Approve a pending commercial change request. **Roles**: The party that received the request
(contractor approves vendor requests; vendor approves contractor requests).

**Response 200**: PO updated with approved changes; both parties notified.

---

## PATCH /v1/purchase-orders/:id/change-requests/:crId/reject

Reject a change request with optional comment.

**Request body**: `{ "comment": "string (optional)" }`

**Response 200**: Change request `status: Rejected`; both parties notified.

---

## POST /v1/rfqs/:rfqId/award-split  (split parent/child POs — US 5.19)

Award line items across one or more vendor quotes for an RFQ and split into per-vendor child POs.
**Roles**: ProcurementOfficer, CompanyAdmin.

> Implemented for US 5.19 / PRD §4.5.4 (reverses the earlier "US 5.11" deferral). The split is
> produced from the quote-review flow, not by splitting a pre-existing PO. See the RFQ contract for
> the canonical endpoint definition.

**Request body**:

```json
{
  "allocations": [
    { "quoteResponseId": "uuid", "quoteLineItemId": "uuid", "approvedQuantity": 6 }
  ]
}
```

**Validation** (US 5.19): `approvedQuantity > 0` and `≤` the vendor's quoted quantity; the sum of
`approvedQuantity` across vendors for one RFQ line must be `≤` the RFQ requested quantity; the line
must have been quoted (not `NO_QUOTE`); each awarded quote must still be awardable.

**Response 201**:

```json
{
  "parentPoId": "uuid",
  "parentPoNumber": "PO-00010",
  "children": [{ "id": "uuid", "poNumber": "PO-00010-1", "vendorId": "uuid", "vendorName": "..." }]
}
```

**Business rules**:

- Persists `approvedQuantity` + `APPROVED` status on each awarded `QuoteResponseLineItem`; marks the
  awarded quotes `APPROVED` and the RFQ `AWARDED`.
- Creates a consolidated **`SPLIT` parent PO** (`vendorId = null`, never issued) and one **child
  `STANDARD` PO per `(vendor, project)`** linked via `parentPoId` (numbered `PO-NNNNN-1`, `-2`, …).
- Children are created as `DRAFT`; the contractor issues each via `POST /:id/issue`, which notifies
  that vendor. A vendor only ever sees its own child PO; the parent is internal-only. Issuing the
  parent itself is rejected.

---

## POST /v1/purchase-orders/validate-items

Check line items against bulk orders and approved RFQs. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:

```json
{
  "projectId": "uuid (required)",
  "lineItems": [
    {
      "materialId": "uuid (required)",
      "quantity": "number (required)"
    }
  ]
}
```

**Response 200**:

```json
{
  "suggestions": [
    {
      "lineItemIndex": 0,
      "materialId": "uuid",
      "warehouseAvailable": { "quantity": 50, "locationId": "uuid" },
      "bulkOrderMatch": { "bulkOrderId": "uuid", "remainingQty": 200, "agreedPrice": 15.5 },
      "rfqMatch": { "rfqId": "uuid", "quoteId": "uuid", "agreedPrice": 14.0 }
    }
  ]
}
```

---

## POST /v1/purchase-orders/:id/copy

Copy a PO to create a new Draft PO with the same data. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 201**: New Draft PO.
