# modules/secrets

Creates Secrets Manager slots under `/forethread-backend/<env>/*`, each encrypted by a per-env customer-managed KMS key. **The module never writes secret values** — it only creates the slot. Populate values out-of-band.

## Inputs

| Name | Required | Default |
|---|---|---|
| `env` | yes | — |
| `secret_names` (set of kebab-case names) | yes | — |
| `recovery_window_days` | no | `30` |
| `kms_deletion_window_days` | no | `30` |

## Outputs

| Name | Description |
|---|---|
| `secret_arns` | Map: short name → ARN |
| `secret_names` | Map: short name → full path |
| `kms_key_arn` | The CMK encrypting all secrets (consumers need `kms:Decrypt`) |

## Setting secret values

After `terraform apply`, set each slot via the AWS CLI:

```bash
for s in jwt-access-secret jwt-refresh-secret resend-api-key gemini-api-key google-places-api-key; do
  aws secretsmanager put-secret-value \
    --secret-id "/forethread-backend/<env>/$s" \
    --secret-string "<value>"
done
```

## Suggested slot list for f3d

Mirrors `apps/backend/.env.example`. The env composition picks which to provision per env.

| Slot | What goes in it |
|---|---|
| `jwt-access-secret` | 32+ random hex chars (`openssl rand -hex 32`) |
| `jwt-refresh-secret` | 32+ random hex chars |
| `resend-api-key` | API key from https://resend.com/api-keys |
| `gemini-api-key` | API key from Google AI Studio |
| `google-places-api-key` | API key from Google Cloud Console |
| `sentry-dsn` | Optional — Sentry DSN if used |
| `smtp-credentials` | Optional — JSON `{"user":...,"pass":...}` for SES fallback |
