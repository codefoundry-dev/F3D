# API Contract: Invoices

**Base path**: `/v1/invoices`
**Module**: `apps/backend/src/modules/invoices/`
**Auth**: Required on all endpoints

---

## GET /v1/invoices

List invoices. **Roles**: ProcurementOfficer, CompanyAdmin, FinancialOfficer
(contractor); Vendor (own invoices only).

**Query params**:
```
page        integer (default 1)
limit       integer (default 25)
status      InvoiceStatus
vendorId    uuid
projectId   uuid
poId        uuid
search      string (invoice number, vendor name)
dateFrom    ISO-8601
dateTo      ISO-8601
sortBy      createdAt | dueDate | status | total
sortDir     asc | desc
```

**Response 200**: Paginated invoice list.

---

## POST /v1/invoices/upload

Upload an invoice file to initiate the processing workflow.
**Roles**: ProcurementOfficer, CompanyAdmin, FinancialOfficer, Vendor.

**Request**: `multipart/form-data`
```
file        File (required; PDF, PNG, JPG, JPEG, XLS/XLSX, DOC/DOCX, CSV; max 10 MB)
poIds       uuid[] (required — one or more linked POs, JSON array)
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "Uploaded",
    "fileUrl": "string",
    "fileName": "string",
    "linkedPOs": [{ "id": "uuid", "poNumber": "string" }],
    "extractionStatus": "Pending | Processing | Complete | Failed",
    "uploadedBy": { "id": "uuid", "name": "string" },
    "uploadedAt": "ISO-8601"
  }
}
```

---

## GET /v1/invoices/:id

Get full invoice details including extracted data and reconciliation state.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invoiceNumber": "string",
    "status": "InvoiceStatus",
    "vendor": { "id": "uuid", "name": "string" },
    "linkedPOs": [{ "id": "uuid", "poNumber": "string" }],
    "fileUrl": "string",
    "extractedData": {
      "vendorName": "string",
      "invoiceDate": "ISO-8601",
      "dueDate": "ISO-8601",
      "subtotal": "number",
      "taxes": "number",
      "total": "number",
      "paymentTerms": "string",
      "currency": "string"
    },
    "lineItems": [
      {
        "id": "uuid",
        "description": "string",
        "quantity": "number",
        "unitPrice": "number",
        "lineTotal": "number",
        "matchedPoLineItemId": "uuid | null",
        "status": "Pending | Approved | Rejected | Disputed"
      }
    ],
    "reconciliationSummary": {
      "ordered": "number",
      "delivered": "number | null",
      "invoiced": "number",
      "discrepancies": "integer"
    },
    "disputes": [],
    "history": [],
    "dueDate": "ISO-8601 | null"
  }
}
```

---

## PATCH /v1/invoices/:id/extracted-data

Update extracted invoice data after user review. **Roles**: ProcurementOfficer,
CompanyAdmin, FinancialOfficer.

**Request body**: Partial of extractedData + lineItems array edits.

**Response 200**: Updated invoice with `status: UnderReview`.

---

## POST /v1/invoices/:id/reconcile

Initiate formal reconciliation. **Roles**: ProcurementOfficer, CompanyAdmin,
FinancialOfficer.

**Response 200**: Reconciliation table returned — ordered vs delivered vs invoiced
quantities with discrepancy flags.

---

## PATCH /v1/invoices/:id/line-items/:lineItemId/approve

Approve a specific invoice line item. **Roles**: ProcurementOfficer, CompanyAdmin,
FinancialOfficer.

**Response 200**: Line item `status: Approved`.

---

## PATCH /v1/invoices/:id/line-items/:lineItemId/reject

Reject a specific invoice line item.

**Request body**: `{ "reason": "string (optional)" }`

**Response 200**: Line item `status: Rejected`; dispute created; vendor notified.

---

## POST /v1/invoices/:id/approve

Approve the entire invoice for payment. Can be done even if some line items are
disputed. **Roles**: ProcurementOfficer, CompanyAdmin, FinancialOfficer.

**Response 200**: Invoice `status: Approved`; vendor notified.

**Business rules**: Cannot approve if any line item has `status: Rejected` and the
rejection is unresolved (dispute still open with no counter-proposal).

---

## POST /v1/invoices/:id/disputes/:disputeId/propose-change

Propose a change to a disputed invoice field.
**Roles**: ProcurementOfficer, CompanyAdmin, FinancialOfficer, Vendor.

**Request body**:
```json
{
  "lineItemId": "uuid (optional — null for header-level change)",
  "field": "string (field path)",
  "proposedValue": "any",
  "comment": "string (optional)"
}
```

**Response 201**: Change proposal created with `status: Pending`.

**Business rules**: While a change is pending for a field, no further changes to that
field can be proposed until the current one is resolved.

---

## PATCH /v1/invoices/:id/disputes/:disputeId/proposals/:proposalId/approve

Approve a change proposal.

**Response 200**: Invoice field updated; dispute status updated.

---

## PATCH /v1/invoices/:id/disputes/:disputeId/proposals/:proposalId/reject

Reject a change proposal.

**Request body**: `{ "reason": "string (optional)" }`

**Response 200**: Proposal rejected; dispute remains open.

---

## GET /v1/invoices/:id/history

Get full immutable audit history for an invoice.

**Response 200**: Array of history entries (action, user, timestamp, changed fields).

---

## POST /v1/invoices/:id/mark-paid

Mark an approved invoice as paid. **Roles**: FinancialOfficer, CompanyAdmin.

**Response 200**: Invoice `status: Paid`; payment due notifications cleared.
