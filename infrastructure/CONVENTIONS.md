# Conventions for `infrastructure/`

These are the rules every Terraform file in this tree follows. Anything new must comply or
explicitly explain why it doesn't.

---

## 1. Provider versions

Terraform: `>= 1.7`. AWS provider: `~> 5.60`. Pinned in every `versions.tf`:

```hcl
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}
```

`.terraform.lock.hcl` is committed — it pins exact provider versions across all environments.

## 2. Naming

All resource names follow `forethread-<env>-<purpose>`:

- `forethread-prod-vpc`
- `forethread-prod-backend-ec2`
- `forethread-prod-backend-rds`
- `forethread-staging-backend-redis`
- `forethread-prod-uploads` (S3 — bucket names are global, so the env is part of the bucket
  identity)

`<env>` is `prod` or `staging`. `<purpose>` is kebab-case and descriptive.

Roles and policies use the same prefix:

- `forethread-prod-backend-ec2-role`
- `forethread-github-actions-terraform-role`

## 3. Tagging

Every taggable resource gets at minimum:

```hcl
tags = merge(var.tags, {
  Name = "forethread-${var.env}-<purpose>"
})
```

Where `var.tags` is the standard tag bundle defined at the env level:

```hcl
tags = {
  Project     = "forethread"
  Environment = var.env       # "prod" | "staging"
  ManagedBy   = "terraform"
  Repository  = "f3d"
  CostCenter  = "forethread-backend"
}
```

`Name` is the only per-resource tag added inside modules.

## 4. Module structure

Every module under `modules/<name>/` has:

```
modules/<name>/
├── README.md          # what it does, inputs, outputs, example usage
├── versions.tf        # required_version + required_providers
├── variables.tf       # input variable declarations with descriptions and types
├── main.tf            # resources
└── outputs.tf         # output declarations with descriptions
```

Optional:

- `iam.tf` / `sg.tf` — split out only when `main.tf` exceeds ~150 lines

## 5. Variables

- Every variable has a `description`
- Every variable has a `type` (no implicit `any`)
- Use `validation` blocks for constrained values (e.g. `env` must be `prod` or `staging`)

## 6. Outputs

- Every output has a `description`
- Outputs that contain credentials use `sensitive = true`

## 7. State backend

Each env in `envs/<env>/` declares its backend in `versions.tf`:

```hcl
terraform {
  backend "s3" {
    bucket         = "forethread-tfstate-eu-north-1"
    key            = "envs/<env>/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "forethread-tfstate-lock"
    encrypt        = true
    kms_key_id     = "alias/forethread-tfstate"
  }
}
```

The `bootstrap/` directory creates the bucket + lock table; it itself uses **local state**
(committed `.terraform.lock.hcl` only, not state file).

## 8. Cross-process contract (SSM Parameter Store)

Resources that the backend or the deploy workflow needs to consume (RDS endpoint, Redis URL, S3
bucket name, SQS ARNs, secret ARNs, ECR repo URI, EC2 instance ID) are published by env composition
under stable names:

```
/forethread/<env>/rds/endpoint
/forethread/<env>/rds/port
/forethread/<env>/rds/master-secret-arn
/forethread/<env>/redis/url
/forethread/<env>/s3/uploads/bucket
/forethread/<env>/s3/uploads/region
/forethread/<env>/sqs/<queue-name>/arn
/forethread/<env>/sqs/<queue-name>/url
/forethread/<env>/secrets/<name>/arn
/forethread/<env>/ecr/backend/repository-url
/forethread/<env>/ec2/backend/instance-id
/forethread/<env>/observability/log-group-name
```

Backend code reads from SSM (or has values injected from SSM by the deploy workflow), never from raw
Terraform output.

## 9. Resource policies — least privilege

- No `Resource: "*"` without a comment explaining why
- IAM policies live in `modules/<x>/iam.tf` (or in `main.tf` if small)
- `aws_iam_policy_document` data sources preferred over inline JSON

## 10. Security groups

- Default deny — explicit allow only
- Use `aws_security_group_rule` resources, not inline `ingress` / `egress` blocks (avoids drift when
  modules need to add rules later)
- Comment every rule with the source/purpose

## 11. Formatting

- `terraform fmt -recursive` before every commit (CI enforces)
- 2-space indentation (Terraform default)

## 12. Common Terraform pitfalls

Inherited from the upstream template. Read this when authoring new modules.

### 12.1 `${...}` inside a `variable` description

Terraform parses **every** string in a `variable` block as a template. `${prefix}` is interpreted as
`var.prefix`, and if no such variable exists, the whole config fails to parse with
`Error: Variables not allowed`.

To literally embed `${...}` in a description, write `$${...}` (Terraform-escape). Or rephrase to
avoid the construct.

### 12.2 `for_each` over a list whose elements are apply-time-unknown

If a module receives `var.allowed_security_group_ids = [module.compute.security_group_id]` from the
env composition, the **list length** is known at plan time but the **SG ID itself** is
`(known after apply)`. `for_each` needs the actual elements as map keys, so it fails. Use
`count = length(...)` with index access instead. See `modules/database-rds/main.tf` for the actual
pattern.

### 12.3 AWS API character allowlist on resource descriptions

Several AWS resources reject descriptions outside `^[0-9A-Za-z_ .:/()#,@\[\]+=&;{}!$*-]*$`. Notably
**no apostrophe**, **no em-dash (—)**, **no `<>`**, **no `→`**.

This applies to AWS API-bound description fields (`aws_security_group.description`,
`aws_security_group_rule.description`, etc.). It does **not** apply to Terraform-only fields
(`variable.description`, `output.description`, comments).

### 12.4 CloudWatch metric filter pattern syntax

CloudWatch's term-OR pattern `?term1 ?term2` cannot be mixed with quoted JSON-shape fragments in the
same pattern. Use term-only patterns (which catch both plain log lines and the substring `error`
inside `{"level":"error"}`).

### 12.5 IAM `aws:ResourceTag` condition applies to EVERY resource in the statement

A single statement that combines a resource without the gated tag and one with it will be rejected
for both. Split into two statements: one allowing the un-tagged resource unconditionally, one
allowing the tagged one gated by the condition. See `modules/ci-oidc-roles/main.tf`.

### 12.6 ECR `image_tag_mutability` is per-repo, not per-tag

Setting `image_tag_mutability = "IMMUTABLE"` blocks every overwrite, including `:latest` on every
deploy. Keep ECR `MUTABLE` and rely on `:sha-<short>` for content-addressed immutability.

### 12.7 GitHub-hosted runner arch for arm64 builds

`runs-on: ubuntu-latest` + `--platform linux/arm64` uses QEMU emulation, which reliably crashes
during `pnpm install`. Use `runs-on: ubuntu-24.04-arm` (native arm64) for the backend image build.

---

## 13. Module input/output contract for env composition

Each module exposes a stable public interface. Changes to inputs/outputs are breaking and require a
coordinated PR.

| Module          | Key inputs                                                                                                                                                                        | Key outputs                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `network`       | `env`, `cidr`, `tags`                                                                                                                                                             | `vpc_id`, `public_subnet_ids`, `private_subnet_ids`                                        |
| `database-rds`  | `env`, `vpc_id`, `private_subnet_ids`, `allowed_security_group_ids`, `backup_retention_days`                                                                                      | `endpoint`, `port`, `db_name`, `master_secret_arn`, `security_group_id`, `instance_id`     |
| `cache-redis`   | `env`, `vpc_id`, `private_subnet_ids`, `allowed_security_group_ids`                                                                                                               | `primary_endpoint_address`, `redis_url`, `security_group_id`, `cluster_id`                 |
| `storage-s3`    | `env`, `cors_allowed_origins`                                                                                                                                                     | `bucket_name`, `bucket_arn`                                                                |
| `compute-ec2`   | `env`, `vpc_id`, `public_subnet_id`, `instance_type`, `rds_master_secret_arn`, `s3_bucket_arns`, `secret_arns_to_read`, `sqs_queue_arns`, `log_group_name`, `host_log_group_name` | `instance_id`, `public_ip`, `security_group_id`, `ecr_repository_url`, `instance_role_arn` |
| `secrets`       | `env`, `secret_names`                                                                                                                                                             | `secret_arns` (map), `kms_key_arn`                                                         |
| `queue-sqs`     | `env`, `queue_names`                                                                                                                                                              | `queue_arns` (map), `queue_urls` (map), `dlq_arns` (map)                                   |
| `observability` | `env`, `notification_email`, `ec2_instance_id`, `rds_instance_id`, `redis_cluster_id`, `sqs_dlq_arns`                                                                             | `log_group_name`, `host_log_group_name`, `sns_topic_arn`                                   |
| `ci-oidc-roles` | `github_org`, `repo_name`                                                                                                                                                         | `oidc_provider_arn`, `terraform_role_arn`, `deploy_role_arn`                               |
