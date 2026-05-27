variable "aws_region" {
  description = "AWS region. The OIDC provider is global but the role policies reference resources scoped to this region."
  type        = string
  default     = "eu-north-1"
}

variable "github_org" {
  description = "GitHub organization (or user) that owns the f3d repo."
  type        = string
  default     = "codefoundry-dev"
}

variable "terraform_branches" {
  description = "Branches in f3d allowed to assume the privileged Terraform role for apply. PRs are always allowed for plan."
  type        = list(string)
  default     = ["main"]
}

variable "deploy_branches" {
  description = "Branches in f3d allowed to assume the deploy role."
  type        = list(string)
  default     = ["main", "staging"]
}
