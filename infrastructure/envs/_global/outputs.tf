output "oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider in this AWS account."
  value       = module.ci_oidc_roles.oidc_provider_arn
}

output "terraform_role_arn" {
  description = "ARN of the privileged role assumed by f3d infrastructure workflows. Set this as the AWS_TERRAFORM_ROLE_ARN repo variable."
  value       = module.ci_oidc_roles.terraform_role_arn
}

output "deploy_role_arn" {
  description = "ARN of the deploy role assumed by f3d backend image/deploy workflows. Set this as the AWS_DEPLOY_ROLE_ARN repo variable."
  value       = module.ci_oidc_roles.deploy_role_arn
}
