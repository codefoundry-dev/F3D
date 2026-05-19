# API Contract: Admin

**Base path**: `/v1/admin`
**Module**: `apps/backend/src/modules/admin/`
**Auth**: Required — SuperAdmin role only on all endpoints

---

## GET /v1/admin/health

System health overview — integrations, background jobs, notification services.

**Response 200**:
```json
{
  "success": true,
  "data": {
    "integrations": [
      {
        "name": "string (e.g., ERP, Accounting, EmailService, OCR)",
        "status": "Healthy | Warning | Error",
        "lastSuccessfulRunAt": "ISO-8601 | null",
        "lastErrorMessage": "string | null",
        "lastErrorAt": "ISO-8601 | null"
      }
    ],
    "backgroundJobs": [
      {
        "name": "string (e.g., invoice-ocr, email-ingestion, notification-dispatch)",
        "status": "Healthy | Warning | Error",
        "queueDepth": 0,
        "lastRunAt": "ISO-8601 | null",
        "lastErrorMessage": "string | null"
      }
    ]
  }
}
```

---

## GET /v1/admin/jobs

List background jobs with their current status and recent history.

**Query params**: `status`, `name`, `page`, `limit`

**Response 200**: Paginated job list.

---

## POST /v1/admin/jobs/:jobId/retry

Retry a failed job or sync.

**Response 200**:
```json
{
  "success": true,
  "data": { "message": "Job queued for retry", "jobId": "uuid", "queuedAt": "ISO-8601" }
}
```

**Business rules**: Action is logged with user ID and timestamp.

---

## PATCH /v1/admin/integrations/:integrationName/disable

Disable an integration.

**Response 200**: Integration disabled; status set to `Disabled`.

---

## PATCH /v1/admin/integrations/:integrationName/enable

Re-enable a disabled integration.

**Response 200**: Integration enabled.

---

## GET /v1/admin/logs

Get system-level error logs.

**Query params**:
```
integrationName   string
jobName           string
level             error | warning | info
dateFrom          ISO-8601
dateTo            ISO-8601
page              integer
limit             integer (default 50)
```

**Response 200**: Paginated log entries.

---

## GET /v1/admin/approval-scenarios

Get all available approval scenario templates (system-defined list).
Used by CompanyAdmin to configure their company's approval workflows.

**Response 200**: Array of scenario definitions.

---

## GET /v1/companies/:companyId/approval-scenarios

Get the approval scenario configuration for a specific contractor company.
**Roles**: CompanyAdmin (own company), SuperAdmin.

---

## PUT /v1/companies/:companyId/approval-scenarios/:scenarioId

Enable/disable and configure an approval scenario for a company.

**Request body**:
```json
{
  "enabled": "boolean (required)",
  "condition": "object (scenario-specific trigger condition)",
  "approverUserIds": ["uuid (min 1 if enabled)"]
}
```

**Response 200**: Updated scenario configuration.

**Business rules**:
- Changes apply immediately to all new actions.
- At least one approver must be assigned before enabling a scenario.

---

## GET /v1/companies/:companyId/rbac-overrides

Get the RBAC action overrides for a company.

---

## PUT /v1/companies/:companyId/rbac-overrides

Update RBAC action overrides.

**Request body**:
```json
{
  "overrides": [
    {
      "role": "UserRole",
      "action": "string (from predefined action list)",
      "allowed": "boolean"
    }
  ]
}
```

**Response 200**: Updated overrides; changes take effect immediately.
