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
- `user_data` that installs Docker, Docker Compose v2 plugin, CloudWatch agent, SSM Agent, and
  writes:
  - `/opt/forethread-backend/Caddyfile` — auto-TLS via Let's Encrypt when `domain_name` is set
  - `/opt/forethread-backend/docker-compose.yml` — Caddy + backend (pulled from ECR `:latest`)
  - `/etc/forethread/backend.env` — runtime env (populated by the deploy workflow from SSM/Secrets
    Manager)
  - CloudWatch agent config for `/var/log/caddy/access.log` and `/var/log/messages`

On first boot Caddy comes up alone (`--no-deps`) because the backend image may not exist yet — the
first deploy via SSM RunCommand lands the image and brings the backend up.

## Inputs

| Name                      | Required | Default             |
| ------------------------- | -------- | ------------------- |
| `env`                     | yes      | —                   |
| `vpc_id`                  | yes      | —                   |
| `public_subnet_id`        | yes      | —                   |
| `rds_master_secret_arn`   | yes      | —                   |
| `rds_security_group_id`   | yes      | —                   |
| `redis_security_group_id` | no       | `""`                |
| `log_group_name`          | yes      | —                   |
| `host_log_group_name`     | yes      | —                   |
| `instance_type`           | no       | `t4g.small`         |
| `root_volume_size_gb`     | no       | `30`                |
| `app_port`                | no       | `3000`              |
| `domain_name`             | no       | `""` (plain HTTP)   |
| `ssm_parameter_prefix`    | no       | `/forethread/<env>` |
| `secret_arns_to_read`     | no       | `[]`                |
| `kms_key_arns_to_decrypt` | no       | `[]`                |
| `sqs_queue_arns`          | no       | `[]`                |
| `s3_bucket_arns`          | no       | `[]`                |
| `tags`                    | no       | `{}`                |

## How env vars reach the backend container

The host writes secrets + SSM-published config into `/etc/forethread/backend.env`, which
docker-compose loads via `env_file`. Two ways to populate it:

1. **Deploy workflow** (recommended) — the GitHub Actions deploy job runs `aws ssm send-command`
   against this instance. The remote script reads `/forethread/<env>/*` from SSM Parameter Store and
   `/forethread-backend/<env>/*` from Secrets Manager, writes them into
   `/etc/forethread/backend.env`, then `docker compose pull && docker compose up -d`.
2. **Backend-side refactor** — long-term, refactor the NestJS bootstrap (`apps/backend/src/main.ts`)
   to pull the same keys at startup via `@aws-sdk/client-ssm` and `@aws-sdk/client-secrets-manager`.
   Then `/etc/forethread/backend.env` can hold only `NODE_ENV`/`PORT`. Either approach works; this
   module is agnostic.

## Known pitfalls

### IAM role-policy attachment vs. EC2 launch race

By default, Terraform builds `aws_instance.this` and
`aws_iam_role_policy_attachment.{runtime,ssm_managed_core}` in parallel — there is no implicit
dependency edge between them because the instance only references the **instance profile**, not the
policy attachments. On a fresh apply the instance can boot and start running `user_data` while the
runtime policy is still being attached.

That matters because `user_data` runs `aws ecr get-login-password | docker login` within seconds of
boot. Without the runtime policy in effect, that call fails with `AccessDeniedException` on
`ecr:GetAuthorizationToken`. Combined with `set -euo pipefail`, the error propagates through the
pipe and **halts cloud-init**. The host comes up with no Caddyfile, no `docker-compose.yml`, no
`/etc/forethread/backend.env`, and no Caddy container — and no SSM Agent either, so it's also
unreachable via Session Manager.

Observed on the f3d staging apply: instance booted at 19:42:25 UTC, `runtime` policy attached at
19:50:29 UTC — an ~8 minute gap.

Fixed in two layers:

1. **Explicit `depends_on`** on `aws_instance.this` (see `main.tf`) for both
   `aws_iam_role_policy_attachment.runtime` and `aws_iam_role_policy_attachment.ssm_managed_core`.
   This forces Terraform to attach both policies before launching the instance.
2. **Retry loop around the first ECR login** in `user_data.sh.tftpl` (6 attempts, 10s apart). Even
   with `depends_on`, IAM propagation from the attachment API to the EC2/STS endpoint can lag by a
   few seconds; the retry loop absorbs that without tripping `pipefail`.

Both layers are needed: removing `depends_on` reintroduces the multi-minute race, and removing the
retry loop reintroduces failures from sub-second IAM propagation lag.
