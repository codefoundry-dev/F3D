output "oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider. One per AWS account; reuse for any future federated role."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "terraform_role_arn" {
  description = "ARN of the privileged Terraform role. Plug into the workflow's `role-to-assume`."
  value       = aws_iam_role.terraform.arn
}

output "terraform_role_name" {
  description = "Name of the privileged Terraform role."
  value       = aws_iam_role.terraform.name
}

output "deploy_role_arn" {
  description = "ARN of the deploy role used by the backend image push + SSM RunCommand workflows."
  value       = aws_iam_role.deploy.arn
}

output "deploy_role_name" {
  description = "Name of the deploy role."
  value       = aws_iam_role.deploy.name
}
