# API Contract: Delivery

**Base path**: `/v1/delivery`
**Module**: `apps/backend/src/modules/delivery/`
**Auth**: Required (registered users); short-lived scoped token (tokenized access)
**Note**: This entire module is Optional for Release 1 (Epic 5 dependency).

---

## POST /v1/delivery/reports

Initiate a delivery report for a PO. **Roles**: ProcurementOfficer, CompanyAdmin,
WarehouseOfficer.

**Request body**:
```json
{
  "purchaseOrderId": "uuid (required)",
  "deliveryDate": "ISO-8601 (optional — defaults to today, user can override)",
  "lineItems": [
    {
      "poLineItemId": "uuid (required)",
      "deliveredQuantity": "number (required)",
      "outcome": "Delivered | PartiallyDelivered | NotDelivered | Rejected",
      "damaged": "boolean (optional)",
      "damagedQuantity": "number (optional)",
      "comment": "string (optional)"
    }
  ],
  "reportLevelComment": "string (optional)",
  "attachments": ["file IDs — photos allowed"]
}
```

**Response 201**: Delivery report created with `status: Submitted`.

**Business rules**:
- Submitted by registered users immediately affects PO delivery status.
- PO delivery status is derived from all linked delivery reports.
- All users assigned to the PO are notified.

---

## POST /v1/delivery/reports/external

Submit a delivery report via tokenized access (non-registered person). This endpoint
accepts the short-lived scoped token from `/v1/auth/tokenized-access/verify`.

**Auth**: Scoped delivery token (not full JWT).

**Request body**: Same as POST /v1/delivery/reports.

**Response 201**: Delivery report created with `status: PendingApproval`.

---

## GET /v1/delivery/reports

List delivery reports. **Roles**: ProcurementOfficer, CompanyAdmin, WarehouseOfficer.

**Query params**:
```
status      DeliveryReportStatus
poId        uuid
dateFrom    ISO-8601
dateTo      ISO-8601
page        integer
limit       integer
```

**Response 200**: Paginated list of delivery report summaries.

---

## GET /v1/delivery/reports/pending-approval

List delivery reports with `status: PendingApproval` (externally submitted).
**Roles**: CompanyAdmin, ProcurementOfficer.

**Response 200**: Paginated list of pending reports.

---

## GET /v1/delivery/reports/:id

Get full delivery report details.

**Response 200**: Full report with line items, outcomes, submitter info, photos.

---

## PATCH /v1/delivery/reports/:id/approve

Approve an externally submitted delivery report.
**Roles**: CompanyAdmin, ProcurementOfficer.

**Response 200**: Report `status: Approved`; PO delivery status updated; data
available for invoice reconciliation.

---

## PATCH /v1/delivery/reports/:id/reject

Reject an externally submitted delivery report.

**Request body**: `{ "comment": "string (required)" }`

**Response 200**: Report `status: Rejected`; PO status unchanged; rejection reason stored.
