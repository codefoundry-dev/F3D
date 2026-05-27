# Account-wide resources. Lives in its own state file so per-env applies
# never touch the OIDC provider or the IAM roles consumed by CI.

locals {
  global_tags = {
    Project    = "forethread"
    ManagedBy  = "terraform"
    Repository = "f3d"
  }
}

module "ci_oidc_roles" {
  source = "../../modules/ci-oidc-roles"

  github_org         = var.github_org
  repo_name          = "F3D"
  terraform_branches = var.terraform_branches
  deploy_branches    = var.deploy_branches
  aws_region         = var.aws_region

  tags = local.global_tags
}
