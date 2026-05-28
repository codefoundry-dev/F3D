variable "github_org" {
  description = "GitHub organization (or user) that owns the f3d repo. Used to build the OIDC trust subject (e.g. 'ohenekwabena' yields 'repo:ohenekwabena/<repo>:...')."
  type        = string

  validation {
    condition     = length(var.github_org) > 0
    error_message = "github_org must not be empty."
  }
}

variable "repo_name" {
  description = "Name of the f3d repo (without org). Both Terraform plan/apply and image push/deploy workflows live in this single monorepo."
  type        = string
  default     = "f3d"
}

variable "terraform_branches" {
  description = "Branches in the f3d repo allowed to assume the Terraform role for 'apply'. PRs are always allowed for 'plan'."
  type        = list(string)
  default     = ["main"]

  validation {
    condition     = length(var.terraform_branches) > 0
    error_message = "terraform_branches must contain at least one branch."
  }
}

variable "deploy_branches" {
  description = "Branches in the f3d repo allowed to assume the deploy role. Default: main -> prod, staging -> staging."
  type        = list(string)
  default     = ["main", "staging"]

  validation {
    condition     = length(var.deploy_branches) > 0
    error_message = "deploy_branches must contain at least one branch."
  }
}

variable "terraform_environments" {
  description = "GitHub Environment names whose jobs may assume the Terraform role. When a workflow job declares `environment:`, the OIDC token sub becomes 'repo:OWNER/REPO:environment:NAME' instead of the branch form, so we list these explicitly."
  type        = list(string)
  default     = ["_global", "prod", "staging"]
}

variable "deploy_environments" {
  description = "GitHub Environment names whose jobs may assume the deploy role."
  type        = list(string)
  default     = ["prod", "staging"]
}

variable "aws_region" {
  description = "AWS region used to scope ECR and SSM resource ARNs in the deploy policy."
  type        = string
  default     = "eu-north-1"
}

variable "tags" {
  description = "Standard tag bundle from the account composition. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
