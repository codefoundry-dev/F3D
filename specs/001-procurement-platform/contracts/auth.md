# API Contract: Authentication

**Base path**: `/v1/auth` **Module**: `apps/backend/src/modules/auth/`

All endpoints in this file are **public** (marked `@Public()` — exempt from global Auth Guard).

---

## POST /v1/auth/login

Initiate login — validate credentials and send OTP.

**Request body**:

```json
{
  "email": "string (required, email format)",
  "password": "string (required, min 8 chars)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "message": "OTP sent to your email address",
    "otpExpiresAt": "ISO-8601 datetime"
  }
}
```

**Response 401**: Invalid credentials or account not Active.

**Business rules**:

- Only users with status `Active` may proceed.
- OTP is 6 digits, valid for 10 minutes.
- OTP is sent to the user's registered email.
- Failed login attempts do not expose whether the email exists.

---

## POST /v1/auth/verify-otp

Complete login by verifying OTP — returns tokens.

**Request body**:

```json
{
  "email": "string (required)",
  "otp": "string (required, 6 digits)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT string",
    "refreshToken": "JWT string",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "role": "UserRole enum",
      "companyId": "uuid",
      "companyType": "CompanyType enum"
    }
  }
}
```

**Response 401**: OTP invalid or expired.

**Business rules**:

- Access token TTL: 15 minutes.
- Refresh token TTL: 7 days.
- OTP is invalidated after first successful use.

---

## POST /v1/auth/refresh

Exchange a valid refresh token for a new access token.

**Request body**:

```json
{
  "refreshToken": "string (required)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT string",
    "expiresIn": 900
  }
}
```

**Response 401**: Refresh token invalid, expired, or revoked.

---

## POST /v1/auth/logout

Revoke refresh token.

**Auth required**: Yes (Bearer access token)

**Request body**: `{}` (empty)

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

## POST /v1/auth/forgot-password

Initiate password reset — send reset link to email.

**Request body**:

```json
{
  "email": "string (required, email format)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "If this email exists, a reset link has been sent" }
}
```

**Business rules**:

- Response is identical whether email exists or not (no enumeration).
- Reset link is valid for 24 hours.

---

## POST /v1/auth/reset-password

Set a new password using a valid reset token.

**Request body**:

```json
{
  "token": "string (required, password reset token)",
  "password": "string (required, min 8 chars, complexity rules apply)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Password reset successfully" }
}
```

**Response 400**: Token invalid or expired.

---

## POST /v1/auth/validate-activation-token

Validate an invitation token and return the associated email + validity status.

**Request body**:

```json
{
  "token": "string (required, invitation token from the activation email)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "email": "user@example.com"
  }
}
```

**Response 400**: Token not found (no matching invitation token in database).

**Business rules**:

- Returns `valid: true` if the token matches and has not expired.
- Returns `valid: false` with the email if the token matches but has expired.
- Throws 400 if no user matches the token at all.
- Rate limited: 10 requests per minute.

---

## POST /v1/auth/request-new-invitation

Self-service resend invitation email for users with `Invited` status.

**Request body**:

```json
{
  "email": "string (required, email format)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "message": "If an account with this email exists and is pending activation, a new invitation has been sent."
  }
}
```

**Business rules**:

- Response is identical whether the email exists or not (no enumeration).
- Only works for users with status `Invited`.
- Generates a new invitation token (30-day expiry) and sends the invitation email.
- Rate limited: 3 requests per hour.

---

## POST /v1/auth/activate

Activate account from invitation link and set password.

**Request body**:

```json
{
  "token": "string (required, invitation token)",
  "password": "string (required, min 8 chars)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": { "message": "Account activated. You may now log in." }
}
```

**Response 400**: Invitation token invalid or expired (>30 days).

**Business rules**:

- Sets user status from `Invited` → `Active`.
- Invalidates the invitation token immediately.

---

## POST /v1/auth/tokenized-access

Exchange a QR/email tokenized link token for delivery report access (non-registered users).

**Request body**:

```json
{
  "token": "string (required, tokenized PO access token)",
  "email": "string (required)",
  "name": "string (required)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "message": "OTP sent to provided email",
    "otpExpiresAt": "ISO-8601 datetime"
  }
}
```

---

## POST /v1/auth/tokenized-access/verify

Verify OTP for tokenized delivery report access.

**Request body**:

```json
{
  "token": "string (required)",
  "otp": "string (required, 6 digits)"
}
```

**Response 200**:

```json
{
  "success": true,
  "data": {
    "accessToken": "string (short-lived, scoped to single PO)",
    "purchaseOrderId": "uuid",
    "expiresIn": 3600
  }
}
```
