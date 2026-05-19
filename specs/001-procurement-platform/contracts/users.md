# API Contract: Users

**Base path**: `/v1/users` **Module**: `apps/backend/src/modules/users/` **Auth**: Required on all
endpoints (Bearer JWT)

---

## GET /v1/users

List all platform users. **Roles**: SuperAdmin only.

**Query params**:

```
page        integer    (default 1)
limit       integer    (default 25, max 100)
search      string     (searches name, email)
companyId   uuid|csv   (filter by company — single ID or comma-separated IDs)
role        UserRole|csv (filter by role — single value or comma-separated, e.g. CompanyAdmin,Vendor)
status      UserStatus|csv (filter: Invited|Active|Inactive — single or comma-separated)
sortBy      string     (default: createdAt)
sortDir     asc|desc   (default: desc)
```

**Response 200**:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "email": "string",
      "role": "UserRole",
      "status": "UserStatus",
      "company": { "id": "uuid", "name": "string", "type": "CompanyType" },
      "createdAt": "ISO-8601",
      "lastLoginAt": "ISO-8601 | null"
    }
  ],
  "meta": { "page": 1, "limit": 25, "total": 142, "totalPages": 6 }
}
```

---

## POST /v1/users

Create a new user and send an invitation email. **Roles**: SuperAdmin, CompanyAdmin.

**Request body**:

```json
{
  "name": "string (required)",
  "email": "string (required, email, unique)",
  "role": "UserRole (required)",
  "companyId": "uuid (required — existing company)",
  "companyType": "CompanyType (required — must match selected company type)"
}
```

**Response 201**:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "role": "UserRole",
    "status": "Invited",
    "company": { "id": "uuid", "name": "string" },
    "invitationSentAt": "ISO-8601"
  }
}
```

**Response 409**: Email already exists.

**Business rules**:

- CompanyAdmin may only create users within their own company.
- CompanyAdmin may assign contractor roles including CompanyAdmin (but not SuperAdmin or Vendor).
- Vendor type company may only have Vendor role users.

---

## GET /v1/users/:id

Get user details. **Roles**: SuperAdmin (any user); CompanyAdmin (own company only); others (own
profile only).

**Response 200**: Single user object (same shape as list item, plus full profile fields).

---

## PATCH /v1/users/:id

Update user details. **Roles**: SuperAdmin (any); CompanyAdmin (own company).

**Request body** (all optional):

```json
{
  "name": "string",
  "role": "UserRole",
  "position": "string"
}
```

**Response 200**: Updated user object.

**Business rules**:

- Role change takes effect immediately for all new actions.
- Cannot change email (requires re-invitation flow).

---

## PATCH /v1/users/:id/deactivate

Deactivate a user account. **Roles**: SuperAdmin, CompanyAdmin (own company).

**Response 200**: Updated user with `status: Inactive`.

**Business rules**:

- Cannot deactivate the sole active CompanyAdmin of a company.
- Deactivated users cannot log in; active sessions are invalidated.
- Email notification is sent to the user.

---

## PATCH /v1/users/:id/reactivate

Reactivate a deactivated user. **Roles**: SuperAdmin, CompanyAdmin.

**Response 200**: Updated user with `status: Active`.

---

## POST /v1/users/:id/initiate-reset-password

Admin-initiated password reset. **Roles**: SuperAdmin only.

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Password reset email sent successfully" }
}
```

**Response 400**: User is not active.

**Business rules**:

- Only valid for users with status `Active`.
- Generates a password reset token (15-minute expiry) and sends a reset link email.
- Uses `getAppUrlForRole()` to build the correct frontend app reset URL.

---

## POST /v1/users/:id/resend-invitation

Resend or refresh an invitation link. **Roles**: SuperAdmin, CompanyAdmin.

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Invitation resent", "invitationSentAt": "ISO-8601" }
}
```

**Business rules**: Only valid for users with status `Invited`. Generates a new token; old token is
immediately invalidated. New token valid for 30 days.

---

## DELETE /v1/users/:id/invitation

Cancel a pending invitation. **Roles**: SuperAdmin, CompanyAdmin.

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Invitation cancelled" }
}
```

**Business rules**: Only valid for users with status `Invited`. Token is immediately invalidated;
user record is removed.

---

## GET /v1/users/me

Get the currently authenticated user's profile.

**Response 200**: Full user profile including company and role details.

---

## PATCH /v1/users/me

Update the current user's own profile fields.

**Request body** (all optional):

```json
{
  "name": "string",
  "position": "string",
  "phone": "string"
}
```

**Response 200**: Updated user profile.

---

## POST /v1/users/me/change-password

Change the current user's password.

**Request body**:

```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required, min 8 chars)"
}
```

**Response 200**: `{ "success": true, "data": { "message": "Password changed" } }`
