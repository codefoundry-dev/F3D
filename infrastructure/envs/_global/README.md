# envs/\_global

Account-wide resources. Lives in its own state file (`envs/_global/terraform.tfstate` in the state
bucket) so per-env applies cannot accidentally touch the OIDC provider or the IAM roles that CI
relies on.

What lives here:

- GitHub Actions OIDC identity provider (one per AWS account)
- `forethread-github-actions-terraform-role` (used by `.github/workflows/terraform-*.yml`)
- `forethread-github-actions-deploy-role` (used by the backend image push + SSM RunCommand deploy
  workflow)

## Apply order

This must be applied **before** any per-env apply, because the per-env workflows assume
`AWS_TERRAFORM_ROLE_ARN` points at the role created here.

```bash
# After bootstrap/ has been applied (state bucket exists)
cd infrastructure/envs/_global
terraform init
terraform plan
terraform apply
```

Then copy the outputs into GitHub:

```
AWS_TERRAFORM_ROLE_ARN -> set as a Variable in ohenekwabena/f3d
AWS_DEPLOY_ROLE_ARN    -> set as a Variable in ohenekwabena/f3d
```

After that, both workflows can run.
