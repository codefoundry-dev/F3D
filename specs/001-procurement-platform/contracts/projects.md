# API Contract: Projects

**Base path**: `/v1/projects` **Module**: `apps/backend/src/modules/projects/` **Auth**: Required on
all endpoints **Access**: Project-scoped — `ProjectAccessGuard` enforces membership on `:id` routes

---

## GET /v1/projects

List projects accessible to the current user. Returns only projects the user is assigned to (via
ProjectMember), except CompanyAdmin who sees all company projects. **Roles**: CompanyAdmin,
ProcurementOfficer, FinancialOfficer, WarehouseOfficer, Foreman.

**Query params**:

```
page        integer (default 1)
limit       integer (default 25)
status      ProjectStatus (Planned | Ongoing | Completed | Archived)
search      string (searches name, description)
sortBy      name | createdAt | status | startDate
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
      "description": "string | null",
      "status": "ProjectStatus",
      "type": "string | null",
      "defaultDeliveryLocation": "string",
      "defaultStorageLocation": "string",
      "memberCount": 3,
      "startDate": "ISO-8601 | null",
      "expectedEndDate": "ISO-8601 | null",
      "createdAt": "ISO-8601"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 8, "totalPages": 1 }
}
```

**Business rules**:

- CompanyAdmin: returns all projects for their company.
- ProcurementOfficer / FinancialOfficer / WarehouseOfficer / Foreman: returns only projects where
  the user is a ProjectMember.
- SuperAdmin: returns all projects across all companies (admin view).
- Default sort: `createdAt DESC`.
- `Archived` projects are excluded by default unless `status=Archived` is explicitly passed.

---

## POST /v1/projects

Create a new project. **Roles**: CompanyAdmin, ProcurementOfficer.

**Request body**:

```json
{
  "name": "string (required, unique within company)",
  "description": "string (optional)",
  "type": "string (optional, from predefined list)",
  "status": "ProjectStatus (required, default Planned)",
  "locations": [
    {
      "type": "Delivery | Storage (required)",
      "address": "string (required)",
      "label": "string (optional)",
      "isDefault": "boolean (required)"
    }
  ],
  "assignedUserIds": ["uuid (required, min 1)"],
  "plannedBudget": "number (optional, >= 0)",
  "currency": "string (optional, default AUD, ISO 4217)",
  "pointOfContactId": "uuid (optional)",
  "startDate": "ISO-8601 (optional)",
  "expectedEndDate": "ISO-8601 (optional)"
}
```

**Response 201**: Created project object (same shape as GET /:id response).

**Validation rules**:

- `locations` must contain at least one entry with `type: Delivery` and `isDefault: true`.
- `locations` must contain at least one entry with `type: Storage` and `isDefault: true`.
- Only one location per type may have `isDefault: true`.
- `assignedUserIds` must reference active users in the same company.
- `pointOfContactId` must reference an active user in the same company.
- `expectedEndDate` must be after `startDate` if both are provided.

**Business rules**:

- The creating user is automatically added to `assignedUserIds` (even if not included).
- ProcurementOfficer cannot include/exclude users other than themselves in `assignedUserIds` — the
  field is ignored for PO role; only the creating user is assigned.
- Duplicate project names within a company are rejected (409 Conflict).

**Error responses**:

- `400`: Validation failure (missing required fields, invalid location config).
- `409`: Project name already exists within the company.

---

## GET /v1/projects/:id

Get project detail. **Roles**: Any user assigned to the project; CompanyAdmin of the owning company;
SuperAdmin. Protected by `ProjectAccessGuard`.

**Response 200**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "description": "string | null",
    "status": "ProjectStatus",
    "type": "string | null",
    "locations": [
      {
        "id": "uuid",
        "type": "Delivery | Storage",
        "address": "string",
        "label": "string | null",
        "isDefault": true
      }
    ],
    "assignedUsers": [
      {
        "id": "uuid",
        "name": "string",
        "email": "string",
        "role": "UserRole",
        "assignedAt": "ISO-8601"
      }
    ],
    "plannedBudget": "number | null",
    "usedBudget": 0,
    "currency": "string",
    "startDate": "ISO-8601 | null",
    "expectedEndDate": "ISO-8601 | null",
    "pointOfContact": { "id": "uuid", "name": "string" },
    "createdBy": { "id": "uuid", "name": "string" },
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "activeBom": null,
    "rfqCount": 0,
    "poCount": 0,
    "invoiceCount": 0,
    "vendorCount": 0
  }
}
```

**Notes**:

- `usedBudget`: Sum of issued PO amounts for the project. Returns `0` until PO module (Epic 5).
- `activeBom`: Returns `null` until BOM module (Epic 7). Future shape: `{ id, version, itemCount }`.
- `rfqCount`, `poCount`, `invoiceCount`, `vendorCount`: Return `0` until respective epics.

**Error responses**:

- `403`: User is not a member and not a CompanyAdmin/SuperAdmin.
- `404`: Project not found.

---

## PATCH /v1/projects/:id

Update project details. **Roles**: CompanyAdmin (full edit); ProcurementOfficer (limited — cannot
change assigned users or status to Archived). Protected by `ProjectAccessGuard`.

**Request body**: Partial of project fields (same shape as POST, all fields optional).

**Validation rules**:

- If `locations` is provided, it replaces ALL locations (full replacement, not merge). The same
  location validation rules apply (at least one default per type).
- `name` uniqueness is re-validated on change.
- Status transitions must follow the state machine (e.g. cannot go from Completed to Planned).

**Response 200**: Updated project object (same shape as GET /:id response).

**Error responses**:

- `400`: Invalid status transition or validation failure.
- `403`: Insufficient permissions.
- `409`: New name conflicts with existing project.

---

## POST /v1/projects/:id/members

Add users to a project. **Roles**: CompanyAdmin only. Protected by `ProjectAccessGuard`.

**Request body**:

```json
{
  "userIds": ["uuid"]
}
```

**Validation rules**:

- All `userIds` must reference active users in the same company as the project.
- Users already assigned are silently skipped (idempotent).

**Response 200**:

```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "uuid",
        "name": "string",
        "email": "string",
        "role": "UserRole",
        "assignedAt": "ISO-8601",
        "assignedBy": { "id": "uuid", "name": "string" }
      }
    ]
  }
}
```

**Error responses**:

- `400`: One or more userIds are invalid or not in the same company.
- `403`: Only CompanyAdmin can manage project members.

---

## DELETE /v1/projects/:id/members/:userId

Remove a user from a project. **Roles**: CompanyAdmin only. Protected by `ProjectAccessGuard`.

**Business rules**:

- Cannot remove the last member from a project (400 error).
- Cannot remove the project creator if they are a ProcurementOfficer (they were auto-assigned).

**Response 200**:

```json
{
  "success": true,
  "data": {
    "members": [...]
  }
}
```

**Error responses**:

- `400`: Cannot remove last member or auto-assigned creator.
- `403`: Only CompanyAdmin can manage project members.
- `404`: User is not a member of this project.

---

## GET /v1/projects/:id/bom

Get the active BOM for a project. **Epic 7 — NOT IMPLEMENTED in Epic 2.**

**Response 501**: `{ "success": false, "error": "BOM management is not yet available" }`

---

## POST /v1/projects/:id/bom

Create or update the project BOM. **Epic 7 — NOT IMPLEMENTED in Epic 2.**

**Response 501**: `{ "success": false, "error": "BOM management is not yet available" }`
