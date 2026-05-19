# API Contract: Bulk Orders

**Base path**: `/v1/bulk-orders`
**Module**: `apps/backend/src/modules/bulk-orders/`
**Auth**: Required on all endpoints

---

## GET /v1/bulk-orders

List bulk orders. **Roles**: ProcurementOfficer, CompanyAdmin; Vendor (own bulk orders).

**Query params**:
```
page        integer
limit       integer (default 25)
status      BulkOrderStatus (Active | Expired | Cancelled)
projectId   uuid
vendorId    uuid
search      string
```

**Response 200**: Paginated list of bulk order summaries with remaining quantities.

---

## POST /v1/bulk-orders

Create a bulk order from an approved quote. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:
```json
{
  "quoteId": "uuid (required — must be an approved quote)",
  "endDate": "ISO-8601 (required)",
  "projectIds": ["uuid (optional — restrict to specific projects)"],
  "lineItems": [
    {
      "quoteLineItemId": "uuid (required)",
      "totalQuantity": "number (required, total committed quantity)",
      "unitPrice": "number (auto-populated from quote, editable)"
    }
  ]
}
```

**Response 201**: Created BulkOrder with `status: Active`.

**Business rules**:
- Bulk order can only be created from an approved RFQ quote response.
- Data is auto-populated from the quote.

---

## GET /v1/bulk-orders/:id

Get full bulk order details including remaining quantities and drawdown history.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "bulkOrderNumber": "string",
    "status": "BulkOrderStatus",
    "vendor": { "id": "uuid", "name": "string" },
    "assignedProjects": [{ "id": "uuid", "name": "string" }],
    "endDate": "ISO-8601",
    "version": 2,
    "lineItems": [
      {
        "id": "uuid",
        "material": { "id": "uuid", "name": "string", "uom": "string" },
        "totalQuantity": 1000,
        "usedQuantity": 250,
        "remainingQuantity": 750,
        "unitPrice": "number"
      }
    ],
    "drawdowns": [
      { "purchaseOrderId": "uuid", "poNumber": "string", "quantity": 50, "date": "ISO-8601" }
    ],
    "history": []
  }
}
```

---

## POST /v1/bulk-orders/:id/change-requests

Propose changes to an active bulk agreement. **Roles**: ProcurementOfficer, CompanyAdmin,
Vendor.

**Request body**:
```json
{
  "changes": {
    "endDate": "ISO-8601 (optional)",
    "lineItems": [
      {
        "lineItemId": "uuid (optional — edit existing)",
        "action": "update | add | remove",
        "unitPrice": "number (optional)",
        "quantity": "number (optional)",
        "uom": "string (optional)"
      }
    ],
    "projectIds": ["uuid (optional — internal contractor change only)"]
  },
  "message": "string (optional)"
}
```

**Response 201**: Change request created as pending; current agreement unchanged.

**Business rules**:
- Project assignment changes by contractor are internal and applied immediately.
- All other changes require other-party approval.
- All proposals, approvals, rejections recorded in history.

---

## PATCH /v1/bulk-orders/:id/change-requests/:crId/approve

Approve a pending change proposal.

**Response 200**: Bulk order updated to new version; both parties notified.

---

## PATCH /v1/bulk-orders/:id/change-requests/:crId/reject

Reject a change proposal with optional reason.

**Request body**: `{ "reason": "string (optional)" }`

**Response 200**: Proposal rejected; current version remains active.

---

## POST /v1/bulk-orders/:id/cancel

Cancel a bulk order. **Roles**: ProcurementOfficer, CompanyAdmin, Vendor.

**Response 200**: BulkOrder `status: Cancelled`; no further drawdowns possible; both
parties notified.

---

## POST /v1/bulk-orders/:id/drawdown

Create a PO drawdown from the bulk order. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:
```json
{
  "projectId": "uuid (required)",
  "deliveryLocationId": "uuid (required)",
  "expectedDeliveryDate": "ISO-8601 (required)",
  "lineItems": [
    {
      "bulkLineItemId": "uuid (required)",
      "quantity": "number (required)"
    }
  ]
}
```

**Response 201**: New PO created from drawdown.

**Business rules**:
- Requested quantities cannot exceed remaining available quantity per line item.
- Standard PO creation rules apply.
- Once issued, the PO reduces the bulk order's remaining quantities.
