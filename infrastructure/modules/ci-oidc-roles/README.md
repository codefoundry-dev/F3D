# modules/ci-oidc-roles

Account-wide GitHub Actions OIDC provider + two IAM roles:

| Role                                       | Used by                                    | Permissions                                                                                                       |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `forethread-github-actions-terraform-role` | `infrastructure/**` plan + apply workflows | `AdministratorAccess` (v1 — tighten later)                                                                        |
| `forethread-github-actions-deploy-role`    | Backend image build + deploy workflow      | ECR push to `forethread-*`, SSM SendCommand to `Project=forethread` instances, read on `/forethread/*` SSM params |

Lives in `envs/_global/` because there is one OIDC provider per AWS account and account-wide IAM
roles outlive any single env.

## Inputs

| Name                     | Required | Default                          |
| ------------------------ | -------- | -------------------------------- |
| `github_org`             | yes      | —                                |
| `repo_name`              | no       | `f3d`                            |
| `terraform_branches`     | no       | `["main"]`                       |
| `deploy_branches`        | no       | `["main", "staging"]`            |
| `terraform_environments` | no       | `["_global", "prod", "staging"]` |
| `deploy_environments`    | no       | `["prod", "staging"]`            |
| `aws_region`             | no       | `eu-north-1`                     |

## Outputs

| Name                 | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `oidc_provider_arn`  | OIDC provider ARN (reuse for any future federated role)      |
| `terraform_role_arn` | Set as `AWS_TERRAFORM_ROLE_ARN` GitHub Variable in this repo |
| `deploy_role_arn`    | Set as `AWS_DEPLOY_ROLE_ARN` GitHub Variable in this repo    |
