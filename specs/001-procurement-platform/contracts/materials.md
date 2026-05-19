# API Contract: Materials

**Base path**: `/v1/materials`
**Module**: `apps/backend/src/modules/materials/`
**Auth**: Required on all endpoints

---

## GET /v1/materials

Search and list materials from the public catalogue.
**Roles**: All authenticated users.

**Query params**:
```
search      string (real-time search — returns top 10 suggestions when typing)
category    uuid
page        integer (default 1)
limit       integer (default 50)
status      MaterialStatus (Public | PendingApproval — SuperAdmin only)
sortBy      name | category | createdAt
sortDir     asc | desc
```

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "upc": "string | null",
      "manufacturer": "string | null",
      "category": { "id": "uuid", "name": "string" },
      "uom": "string",
      "description": "string | null",
      "status": "MaterialStatus"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 1200 }
}
```

---

## GET /v1/materials/suggestions

Real-time search suggestions for use in RFQ/PO line item input.
Returns max 10 results, includes recently used + BOM-linked materials.
**Roles**: ProcurementOfficer, CompanyAdmin.

**Query params**:
```
q           string (required, min 2 chars)
projectId   uuid (optional — include BOM materials for this project)
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "catalogueMatches": [],
    "recentlyUsed": [],
    "bomLinked": []
  }
}
```

---

## POST /v1/materials

Add a new material. **Roles**: SuperAdmin (status: Public directly); others
(status: PendingApproval — requires admin review).

**Request body**:
```json
{
  "name": "string (required)",
  "categoryId": "uuid (required)",
  "uom": "string (required)",
  "upc": "string (optional)",
  "manufacturer": "string (optional)",
  "description": "string (optional)"
}
```

**Response 201**: Created material.

**Business rules**:
- System prevents duplicate material names in the public catalogue (409 if duplicate).
- Non-admin submissions receive `status: PendingApproval`.

---

## POST /v1/materials/bulk-import

Bulk import materials from a file. **Roles**: SuperAdmin, ProcurementOfficer, CompanyAdmin.

**Request**: `multipart/form-data`
```
file        File (required; XLS, XLSX, CSV)
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "uploadId": "uuid",
    "detectedColumns": [
      {
        "index": 0,
        "header": "Product Name",
        "suggestedMapping": "name"
      }
    ],
    "rowCount": 150,
    "status": "AwaitingColumnMapping"
  }
}
```

---

## POST /v1/materials/bulk-import/:uploadId/confirm-mapping

Confirm column mapping and trigger material extraction.

**Request body**:
```json
{
  "columnMappings": [
    { "index": 0, "mappedTo": "name" },
    { "index": 1, "mappedTo": "uom" },
    { "index": 2, "mappedTo": "category" }
  ]
}
```

**Response 200**: Extraction result with materials for review (including duplicate flags).

---

## POST /v1/materials/bulk-import/:uploadId/save

Save confirmed extracted materials.

**Request body**:
```json
{
  "materials": [
    {
      "name": "string",
      "categoryId": "uuid",
      "uom": "string",
      "manufacturer": "string | null"
    }
  ]
}
```

**Response 201**: Created materials.

---

## GET /v1/materials/:id

Get material details. **Roles**: All authenticated users.

---

## PATCH /v1/materials/:id

Update a material. **Roles**: SuperAdmin (any); others (suggest change — creates
PendingApproval suggestion).

---

## PATCH /v1/materials/:id/approve

Approve a pending material suggestion. **Roles**: SuperAdmin only.

**Response 200**: Material `status: Public`; visible to all users immediately.

---

## PATCH /v1/materials/:id/reject

Reject a pending material suggestion. **Roles**: SuperAdmin only.

**Response 200**: Material suggestion rejected; submitter notified.

---

## GET /v1/materials/categories

List all material categories. **Roles**: All authenticated users.

---

## POST /v1/materials/lists

Create a saved materials list. **Roles**: ProcurementOfficer, CompanyAdmin.

**Request body**:
```json
{
  "name": "string (required)",
  "materialIds": ["uuid"]
}
```

**Response 201**: Created list.

---

## GET /v1/materials/lists

Get the current user's saved materials lists.

**Response 200**: Array of lists with material counts.

---

## POST /v1/materials/favourites/:materialId

Add a material to the user's favourites. **Roles**: ProcurementOfficer, CompanyAdmin.

**Response 200**: Confirmation.

---

## DELETE /v1/materials/favourites/:materialId

Remove from favourites.
