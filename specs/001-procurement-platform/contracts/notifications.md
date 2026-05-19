# API Contract: Notifications

**Base path**: `/v1/notifications`
**Module**: `apps/backend/src/modules/notifications/`
**Auth**: Required on all endpoints

---

## GET /v1/notifications

Get the current user's notifications, newest first.

**Query params**:
```
page    integer (default 1)
limit   integer (default 25)
read    boolean (filter: true = read only, false = unread only)
type    NotificationType
```

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "NotificationType",
      "title": "string",
      "body": "string",
      "read": false,
      "documentType": "RFQ | PO | Invoice | BulkOrder | DeliveryReport | null",
      "documentId": "uuid | null",
      "createdAt": "ISO-8601"
    }
  ],
  "meta": { "unreadCount": 5, "total": 42 }
}
```

---

## PATCH /v1/notifications/:id/read

Mark a notification as read.

**Response 200**: Updated notification with `read: true`.

---

## POST /v1/notifications/mark-all-read

Mark all of the current user's notifications as read.

**Response 200**: `{ "success": true, "data": { "markedCount": 12 } }`

---

## GET /v1/notifications/preferences

Get the current user's notification preferences.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "channels": {
      "inApp": true,
      "email": true
    },
    "events": {
      "rfqReceived": { "inApp": true, "email": true },
      "quoteSubmitted": { "inApp": true, "email": true },
      "poIssued": { "inApp": true, "email": true },
      "invoiceUploaded": { "inApp": true, "email": false },
      "paymentDueSoon": { "inApp": true, "email": true },
      "approvalRequired": { "inApp": true, "email": true }
    }
  }
}
```

---

## PATCH /v1/notifications/preferences

Update the current user's notification preferences.

**Request body**: Partial preferences object.

**Response 200**: Updated preferences.
