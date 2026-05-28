# infrastructure/

Terraform-managed AWS infrastructure for the **f3d / forethread** platform. Adapted from the
`tdx-infrastructure` template — same patterns (env-per-stack, SSM Parameter Store as cross-process
contract, OIDC for CI), with f3d-specific modules added for Redis (ElastiCache) and S3 uploads.

This tree provisions everything that lives in AWS:

- VPC + public/private subnets
- EC2 backend host (Graviton, Caddy + Docker Compose) + ECR
- RDS Postgres 16
- ElastiCache Redis 7
- S3 uploads bucket
- Secrets Manager slots + per-env KMS key
- SQS queues + DLQs (empty default — opt in when workers exist)
- CloudWatch log groups + alarms + SNS topic
- GitHub Actions OIDC provider + roles

**AWS region:** `eu-north-1` (Stockholm). **Environments:** `prod`, `staging`.

---

## Layout

```
infrastructure/
├── bootstrap/              # one-time: state bucket + DynamoDB lock + KMS key
├── modules/
│   ├── network/            # VPC, subnets, route tables, IGW
│   ├── compute-ec2/        # EC2 + instance profile + ECR + Caddy bootstrap
│   ├── database-rds/       # RDS Postgres + parameter group + master credentials
│   ├── cache-redis/        # ElastiCache Redis single-node              (NEW vs TDX)
│   ├── storage-s3/         # S3 uploads bucket                           (NEW vs TDX)
│   ├── secrets/            # Secrets Manager slots wrapped in a KMS key
│   ├── queue-sqs/          # SQS main queue + companion DLQ
│   ├── observability/      # CloudWatch log groups, alarms, SNS topic
│   └── ci-oidc-roles/      # GitHub Actions OIDC provider + IAM roles
└── envs/
    ├── _global/            # account-wide resources (OIDC + CI roles)
    ├── prod/               # composes modules into the prod stack
    └── staging/            # composes modules into the staging stack
```

CI workflows live at the repo root, so they sit next to the existing `.github/workflows/ci.yml`:

```
.github/workflows/
├── ci.yml                  # existing app CI
├── terraform-plan.yml      # fmt + validate + plan on PR (paths: infrastructure/**)
└── terraform-apply.yml     # apply on merge to main, gated by GitHub environments
```

---

## First-time setup (run once per AWS account)

```bash
export AWS_PROFILE=forethread-admin

# 1. State backend (uses local state)
cd infrastructure/bootstrap
terraform init && terraform apply

# 2. Account-wide CI roles (uses remote state in the bucket above)
cd ../envs/_global
terraform init && terraform apply

# 3. Wire the role ARNs into GitHub
gh variable set AWS_TERRAFORM_ROLE_ARN \
  --repo ohenekwabena/f3d \
  --body "$(terraform output -raw terraform_role_arn)"
gh variable set AWS_DEPLOY_ROLE_ARN \
  --repo ohenekwabena/f3d \
  --body "$(terraform output -raw deploy_role_arn)"

# 4. (one-time) Create GitHub Environments for the apply workflow to gate on
gh api -X PUT repos/ohenekwabena/f3d/environments/staging
echo '{"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' \
  | gh api -X PUT repos/ohenekwabena/f3d/environments/prod --input -
gh api -X POST repos/ohenekwabena/f3d/environments/prod/deployment-branch-policies -f name=main
gh api -X PUT repos/ohenekwabena/f3d/environments/_global
```

Set the per-env `NOTIFICATION_EMAIL_PROD` and `NOTIFICATION_EMAIL_STAGING` Variables (repo or
environment-scoped) before the first env apply, or pass `-var` from the CLI.

---

## Day-to-day workflow

### Apply changes via PR (preferred)

1. Branch off `main`, edit terraform files.
2. Open a PR. The plan workflow runs `terraform fmt -check -recursive`, validates every module, and
   produces a `terraform plan` for every affected env.
3. Read the plan summary in the PR comment / Actions artifact.
4. Merge to `main`. The apply workflow runs on push, gated by the GitHub `environment:` rules.

### Apply locally (faster iteration on staging)

```bash
export AWS_PROFILE=forethread-admin

cd infrastructure/envs/staging   # or envs/prod
terraform init
terraform plan  -var "notification_email=<your@email>"
terraform apply -var "notification_email=<your@email>"
```

A typical full env apply takes **~7–10 minutes** (RDS + ElastiCache provisioning is the slow step).

---

## After the first env apply

1. **Confirm the SNS email subscription** — AWS sends a confirmation link to the address you passed
   as `notification_email`. Alarms won't deliver until you click it.
2. **Populate the Secrets Manager values** — slots are empty by design. The backend will not start
   until you set them. See `modules/secrets/README.md`.
3. **Point DNS at the env Elastic IP** — `api.forethread.com` for prod and
   `api-stage.forethread.com` for staging should point at each env's `ec2_public_ip` output. Caddy
   obtains a real Let's Encrypt cert on first start.
4. **Run the first deploy** — push the backend image to ECR and `aws ssm send-command` to pull it on
   the EC2 box. See `modules/compute-ec2/README.md` § "How env vars reach the backend container".

---

## Where things map from `docker-compose.production.yml`

| docker-compose service          | AWS resource                                                             | Module         |
| ------------------------------- | ------------------------------------------------------------------------ | -------------- |
| `postgres` (postgres:16-alpine) | RDS Postgres 16                                                          | `database-rds` |
| `redis` (redis:7-alpine)        | ElastiCache Redis 7                                                      | `cache-redis`  |
| `minio` (uploads)               | S3 bucket (`forethread-<env>-uploads`)                                   | `storage-s3`   |
| `backend` (NestJS image)        | EC2 + ECR + docker-compose                                               | `compute-ec2`  |
| `caddy` (TLS termination)       | Caddy bootstrapped via user_data on the EC2 box                          | `compute-ec2`  |
| `mailhog`                       | (out — use Resend in prod via the `resend-api-key` Secrets Manager slot) | —              |

---

## Conventions in 30 seconds

- Region: **eu-north-1** (Stockholm).
- Naming: `forethread-<env>-<purpose>` everywhere.
- All resources tagged `Project=forethread Environment=<env> ManagedBy=terraform`.
- Modules are stateless; env composition wires them together.
- Cross-process contract: each env publishes outputs under `/forethread/<env>/*` in SSM Parameter
  Store; the backend reads from there at deploy time (or at boot, after the SSM-bootstrap refactor
  lands).
- Two GitHub Actions OIDC roles: `terraform-role` (privileged) and `deploy-role` (ECR push + SSM
  RunCommand only).

See [`CONVENTIONS.md`](./CONVENTIONS.md) for the full set of rules every Terraform file in this tree
follows.

---

## Known follow-ups

| Item                                                                                       | Why                                                                                                                                                                                                                                            | When                                       |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Backend reads its env from SSM/Secrets Manager directly                                    | Today the deploy workflow must populate `/etc/forethread/backend.env` on the EC2 host before `docker compose up`. Long-term, `apps/backend/src/main.ts` should fetch the same keys at startup so the host file only carries `NODE_ENV`/`PORT`. | Before prod traffic.                       |
| GitHub Actions deploy workflow for the backend image                                       | The infra is ready (ECR + SSM SendCommand role) but the actual deploy job (`.github/workflows/deploy.yml`) does not exist yet.                                                                                                                 | Next step after the first env apply.       |
| Replace `AdministratorAccess` on the Terraform CI role with a `forethread-*`-scoped policy | The privileged role is intentionally broad for v1; tighten after 2–3 successful applies confirm the resource set is stable.                                                                                                                    | After v1 stabilises.                       |
| Branch protection on `main`                                                                | The `prod` env's `custom_branch_policies` already restricts deployment; full branch protection blocks direct pushes too.                                                                                                                       | Before prod traffic.                       |
| IAM human-user identities (`tdx-admin-readonly` / `-write`)                                | Tactical fix for ad-hoc ops; longer-term move to IAM Identity Center / SSO. Skipped for v1.                                                                                                                                                    | When more than one human needs AWS access. |
