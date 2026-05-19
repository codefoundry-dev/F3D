# API Contract: Companies

**Base path**: `/v1/companies`
**Module**: `apps/backend/src/modules/companies/`
**Auth**: Required on all endpoints

---

## GET /v1/companies

List companies. **Roles**: SuperAdmin (all); CompanyAdmin (own company only).

**Query params**:
```
page        integer
limit       integer (default 25)
type        CompanyType (Contractor | Vendor)
search      string
sortBy      name | createdAt
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
      "type": "CompanyType",
      "status": "Active | Inactive",
      "email": "string",
      "userCount": 3,
      "createdAt": "ISO-8601"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 20 }
}
```

---

## POST /v1/companies

Create a new company (used during user creation flow). **Roles**: SuperAdmin.

**Request body**:
```json
{
  "name": "string (required, unique)",
  "type": "CompanyType (required)",
  "email": "string (required for Vendor type)",
  "legalName": "string (optional)",
  "abn": "string (optional)",
  "specialisations": ["uuid"]
}
```

**Response 201**: Created company object.

**Business rules**:
- Company cannot be created without at least one user (enforced by combined user+company creation flow in POST /v1/users).
- For Vendor companies: email and at least one contractor assignment required.

---

## GET /v1/companies/:id

Get company details. **Roles**: SuperAdmin (any); CompanyAdmin (own); others (own).

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "type": "CompanyType",
    "legalName": "string",
    "tradeName": "string",
    "abn": "string",
    "taxCode": "string",
    "legalAddress": "string",
    "email": "string",
    "phone": "string",
    "website": "string",
    "specialisations": [{ "id": "uuid", "name": "string" }],
    "warehouseLocations": [
      { "id": "uuid", "address": "string", "city": "string", "postcode": "string" }
    ],
    "users": [{ "id": "uuid", "name": "string", "role": "UserRole", "status": "UserStatus" }],
    "complianceDocuments": [{ "id": "uuid", "name": "string", "url": "string" }]
  }
}
```

---

## PATCH /v1/companies/:id

Update company profile. **Roles**: SuperAdmin (any); CompanyAdmin (own company).

**Request body**: Partial of company fields (name, legalName, abn, email, phone, website,
legalAddress, specialisations, warehouseLocations).

**Response 200**: Updated company object.

**Business rules**: Changes apply immediately to all active workflows.

---

## GET /v1/companies/:id/vendors

List vendors associated with a contractor company. **Roles**: CompanyAdmin,
ProcurementOfficer (own company).

**Query params**: `search`, `status (Invited | Active)`, `specialisation`

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "status": "VendorStatus",
      "specialisations": ["string"],
      "salesReps": [
        {
          "name": "string",
          "email": "string",
          "phone": "string",
          "position": "string"
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 10 }
}
```

---

## POST /v1/companies/:id/vendors

Invite a vendor to the contractor's vendor list. **Roles**: CompanyAdmin,
ProcurementOfficer.

**Request body**:
```json
{
  "companyName": "string (required)",
  "companyEmail": "string (required)",
  "repName": "string (required)",
  "repEmail": "string (required)"
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "vendorId": "uuid",
    "status": "Invited | Active",
    "message": "Vendor invited | Vendor already exists and added to your list"
  }
}
```

**Business rules**:
- If vendor company already exists on platform → add to contractor's vendor list
  directly; no new invitation sent.
- If vendor is new → create vendor company + user, send invitation to both
  companyEmail and repEmail.
