# modules/storage-s3

Application uploads bucket. Replaces the MinIO container used in `docker-compose.production.yml` for local development. Backend authenticates via the EC2 instance role — no access keys.

## Key behavior

- Versioned, AES256-encrypted, public access blocked.
- Non-current versions expire after `noncurrent_version_expiration_days` (default 90).
- Optional CORS — pass `cors_allowed_origins` to allow direct browser uploads via presigned URLs.
- Multipart uploads aborted after 7 days to avoid orphaned data.
- `BucketOwnerEnforced` ownership so ACLs are disabled (modern S3 default).

## Inputs

| Name | Required | Default |
|---|---|---|
| `env` | yes | — |
| `bucket_name` | no | `forethread-<env>-uploads` |
| `cors_allowed_origins` | no | `[]` |
| `noncurrent_version_expiration_days` | no | `90` |

## Outputs

| Name | Description |
|---|---|
| `bucket_name` | The backend's `S3_BUCKET` env value |
| `bucket_arn` | Pass to `compute-ec2`'s `s3_bucket_arns` input |
| `bucket_regional_domain_name` | Regional S3 endpoint |

## Backend env mapping

| Env var | Value |
|---|---|
| `S3_BUCKET` | `bucket_name` output |
| `S3_REGION` | The deployment region (passed by env composition) |
| `S3_ENDPOINT` | Leave **unset** in production — the AWS SDK resolves the real endpoint |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Leave **unset** — instance role auth |
| `S3_FORCE_PATH_STYLE` | `false` (used only with MinIO locally) |
