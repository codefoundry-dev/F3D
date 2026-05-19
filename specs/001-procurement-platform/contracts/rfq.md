# API Contract: RFQ (Request for Quotation)

**Base path**: `/v1/rfq` **Module**: `apps/backend/src/modules/rfqs/` **Auth**: Required on all
endpoints

---

## GET /v1/rfq

List RFQs. **Roles**: ProcurementOfficer, CompanyAdmin (contractor — own company projects); Vendor
(RFQs sent to them).

**Query params**:

```
page           integer (default 1)
limit          integer (default 25, max 100)
projectId      uuid
status         RfqStatus (DRAFT | OPEN | AWAITING_RESPONSE | QUOTED | AWARDED | CLOSED | CANCELLED)
vendorId       uuid
createdById    uuid
dateFrom       ISO-8601 date
dateTo         ISO-8601 date
deadlineFrom   ISO-8601 date
deadlineTo     ISO-8601 date
search         string (RFQ number or project name)
preset         my | open | awaiting_responses | no_quotes | awarded | closed
sortBy         deadline | createdAt | status
sortDir        asc | desc
```

**Response 200**:

```json
{
  "items": [
    {
      "id": "uuid",
      "rfqNumber": "string",
      "project": { "id": "uuid", "name": "string" },
      "status": "RfqStatus",
      "deadlineEnd": "ISO-8601",
      "lineItemCount": 5,
      "invitedVendorCount": 3,
      "receivedQuoteCount": 2,
      "approvedLineItemCount": 0,
      "currency": "string",
      "createdBy": { "id": "uuid", "name": "string" },
      "createdAt": "ISO-8601",
      "approvalStatus": "string | null"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 47 }
}
```

---

## POST /v1/rfq

Create an RFQ. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:

```json
{
  "projectId": "uuid (required)",
  "deadlineEnd": "ISO-8601 (required — response deadline)",
  "deliveryLocationId": "uuid (required, FK to ProjectLocation)",
  "needByDate": "ISO-8601 (optional)",
  "holdForRelease": "boolean (optional, default false)",
  "earliestDeliveryDate": "ISO-8601 (required if holdForRelease: true)",
  "currency": "string (default: AUD)",
  "lineItems": [
    {
      "materialId": "uuid (required, FK to Material catalogue)",
      "quantity": "number (required, > 0)",
      "uom": "string (required)",
      "costCode": "string (optional, from ERP)",
      "notes": "string (optional)",
      "pickUp": "boolean (optional, default false)"
    }
  ],
  "vendorIds": ["uuid (min 1 — invited vendors)"],
  "message": "string (optional)",
  "attachments": ["file IDs from pre-upload"]
}
```

> **Note (FRD US 5.05)**: FRD specifies project as multi-select. Current schema uses single
> `projectId`. This will be revisited when multi-project RFQ support is needed.

> **FRD US 5.05 AC 2**: Materials must come from the Material Catalogue. Users can manually enter a
> name and create a new catalogue entry on the fly (AC 2.2).

**Response 201**: Created RFQ object with `status: DRAFT` and system-generated RFQ number.

**Business rules**:

- After line items are added, system checks active bulk orders; response includes `bulkSuggestions`
  array with suggested drawdowns.
- If all items are covered by bulk orders and user confirms, no RFQ is created.

---

## POST /v1/rfq/:id/send

Send a draft RFQ to vendors. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**: `{}` (empty — uses vendorIds from the RFQ record)

**Response 200**: RFQ updated with `status: OPEN`; vendors are notified.

---

## GET /v1/rfq/:id

Get RFQ details including all vendor quote responses. **Roles**: ProcurementOfficer, CompanyAdmin;
Vendor (own quotes only, filtered view).

**Response 200**: Full RFQ object with line items, vendor responses, and related POs.

---

## PATCH /v1/rfq/:id

Edit an RFQ. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**: Partial RFQ fields.

**Response 200**: Updated RFQ.

**Business rules**: Cannot edit after any vendor has submitted a response. Status must be `DRAFT` or
`OPEN` (no responses yet).

---

## DELETE /v1/rfq/:id

Cancel an RFQ. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: RFQ with `status: CANCELLED`. All invited vendors are notified.

---

## POST /v1/rfq/:id/check-bulk

Check line items against active bulk orders and return suggestions.

**Response 200**:

```json
{
  "suggestions": [
    {
      "lineItemId": "uuid",
      "materialName": "string",
      "bulkOrderId": "uuid",
      "availableQuantity": 500,
      "suggestedQuantity": 100,
      "vendor": { "id": "uuid", "name": "string" }
    }
  ]
}
```

---

## POST /v1/rfq/:id/confirm-bulk-suggestions

Confirm bulk drawdown suggestions; removes confirmed items from RFQ and initiates drawdowns.

**Request body**:

```json
{
  "confirmedLineItemIds": ["uuid"],
  "rejectedLineItemIds": ["uuid"]
}
```

**Response 200**: Updated RFQ (confirmed items removed); drawdown POs created.

---

## GET /v1/rfq/:id/quotes

Get all vendor quote responses for an RFQ. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: Array of Quote objects with line items and vendor details.

---

## POST /v1/rfqs/:rfqId/quotes (Vendor endpoint)

Submit a quote response to an RFQ. **Roles**: Vendor (also accessible via invitation token without
full authentication).

**Request body**:

```json
{
  "lineItems": [
    {
      "rfqLineItemId": "uuid (required)",
      "unitPrice": "number (required)",
      "quotedQuantity": "number (required)",
      "availability": "Available | PartiallyAvailable | Unavailable | NO_QUOTE",
      "deliveryDate": "ISO-8601 (required)",
      "substituteItemId": "uuid (optional — suggest alternative material)",
      "discount": "number (optional)",
      "discountType": "PERCENT | AMOUNT (optional)",
      "tax": "number (optional, %)",
      "taxIncluded": "boolean (optional, default false)",
      "backOrderQty": "number (optional)",
      "backOrderDeliveryDate": "ISO-8601 (optional)",
      "notes": "string (optional)"
    }
  ],
  "bulkDeliveryTime": "ISO-8601 (optional)",
  "bulkDiscount": "number (optional, %)",
  "bulkTax": "number (optional, %)",
  "bulkShipment": "number (optional)",
  "warehouseLocationId": "uuid (optional)",
  "validityPeriod": "ISO-8601 (optional)",
  "message": "string (optional)",
  "attachmentIds": ["file UUIDs (optional, persisted as QuoteAttachment records)"]
}
```

**Response 201**: Created Quote with `status: SUBMITTED`. Includes `lineItems`, `attachments` (array
of `{ id, fileId, filename, mimeType, size }`), and `vendor` info.

Non-submitted RFQ line items are automatically created with `availability: NO_QUOTE`.

---

## PATCH /v1/rfqs/:rfqId/quotes/:quoteId (Vendor endpoint)

Update a previously submitted quote response. **Roles**: Vendor (must own the quote).

Allowed while RFQ status is not CLOSED or CANCELLED. Replaces all line items and attachments
(delete + re-create). Contractor is notified via email on update.

**Request body**: Same as POST (SubmitQuoteDto).

**Response 200**: Updated Quote with refreshed line items and attachments.

---

## GET /v1/rfqs/:rfqId/quotes/:quoteId

Get quote response detail. **Roles**: Vendor (owner) or CompanyAdmin/ProcurementOfficer
(contractor).

**Response 200**: Quote with `lineItems`, `attachments`, `vendor`, `warehouseLocation`, and `rfq`
info.

---

## PATCH /v1/rfq/:rfqId/quotes/:quoteId/line-items/:lineItemId/approve

Approve a specific quote line item. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:

```json
{
  "approvedQuantity": "number (required, > 0, <= quotedQuantity)"
}
```

**Response 200**: Updated line item with `status: Approved`.

---

## PATCH /v1/rfq/:rfqId/quotes/:quoteId/line-items/:lineItemId/decline

Decline a specific quote line item. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: Updated line item with `status: Declined`.

---

## POST /v1/rfq/:rfqId/quotes/:quoteId/convert

Convert an approved quote to a procurement document.

**Request body**:

```json
{
  "type": "StandardPO | BulkOrder | HoldForRelease (required)",
  "approvedLineItemIds": ["uuid (required, must all have status Approved)"]
}
```

**Response 201**: Created PO or BulkOrder document.

---

## GET /v1/rfqs/invitation/:token (Public)

Get RFQ details via invitation token (no authentication required). Returns RFQ info, line items,
vendor name, contractor name, and project name.

**Response 200**: Guest-friendly RFQ detail object.

---

## POST /v1/rfqs/invitation/:token/quote (Public)

Submit a guest quote response via invitation token (no authentication required).

**Request body**: Same as POST /v1/rfqs/:rfqId/quotes (SubmitQuoteDto).

**Response 201**: Created Quote with `status: SUBMITTED`.
