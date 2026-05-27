# modules/compute-ec2

EC2 backend host on Graviton (`t4g.*`), backed by Amazon Linux 2023 ARM64. Provisions:

- Single EC2 instance in a public subnet with an Elastic IP (so DNS stays stable across rebuilds).
- ECR repository for the backend image (`forethread-<env>-backend`).
- Instance security group (HTTP/HTTPS in, all out).
- IAM instance role with **least-privilege** scopes for:
  - ECR pull (only this env's repo)
  - Secrets Manager + KMS for app secrets + the RDS master credential
  - SQS (only the queues passed in)
  - S3 (only the buckets passed in — bucket-level **and** object-level actions)
  - CloudWatch Logs writes (only the env's groups)
  - SSM Parameter Store read on `<ssm_prefix>/*`
  - SSM Agent core (`AmazonSSMManagedInstanceCore`)
- `user_data` that installs Docker, Docker Compose v2 plugin, CloudWatch agent, SSM Agent, and writes:
  - `/opt/forethread-backend/Caddyfile` — auto-TLS via Let's Encrypt when `domain_name` is set
  - `/opt/forethread-backend/docker-compose.yml` — Caddy + backend (pulled from ECR `:latest`)
  - `/etc/forethread/backend.env` — runtime env (populated by the deploy workflow from SSM/Secrets Manager)
  - CloudWatch agent config for `/var/log/caddy/access.log` and `/var/log/messages`

On first boot Caddy comes up alone (`--no-deps`) because the backend image may not exist yet — the first deploy via SSM RunCommand lands the image and brings the backend up.

## Inputs

| Name | Required | Default |
|---|---|---|
| `env` | yes | — |
| `vpc_id` | yes | — |
| `public_subnet_id` | yes | — |
| `rds_master_secret_arn` | yes | — |
| `rds_security_group_id` | yes | — |
| `redis_security_group_id` | no | `""` |
| `log_group_name` | yes | — |
| `host_log_group_name` | yes | — |
| `instance_type` | no | `t4g.small` |
| `root_volume_size_gb` | no | `30` |
| `app_port` | no | `3000` |
| `domain_name` | no | `""` (plain HTTP) |
| `ssm_parameter_prefix` | no | `/forethread/<env>` |
| `secret_arns_to_read` | no | `[]` |
| `kms_key_arns_to_decrypt` | no | `[]` |
| `sqs_queue_arns` | no | `[]` |
| `s3_bucket_arns` | no | `[]` |
| `tags` | no | `{}` |

## How env vars reach the backend container

The host writes secrets + SSM-published config into `/etc/forethread/backend.env`, which docker-compose loads via `env_file`. Two ways to populate it:

1. **Deploy workflow** (recommended) — the GitHub Actions deploy job runs `aws ssm send-command` against this instance. The remote script reads `/forethread/<env>/*` from SSM Parameter Store and `/forethread-backend/<env>/*` from Secrets Manager, writes them into `/etc/forethread/backend.env`, then `docker compose pull && docker compose up -d`.
2. **Backend-side refactor** — long-term, refactor the NestJS bootstrap (`apps/backend/src/main.ts`) to pull the same keys at startup via `@aws-sdk/client-ssm` and `@aws-sdk/client-secrets-manager`. Then `/etc/forethread/backend.env` can hold only `NODE_ENV`/`PORT`. Either approach works; this module is agnostic.
