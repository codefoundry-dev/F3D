variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'. Used in secret name prefixes, the KMS alias, and resource tags."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "secret_names" {
  description = "Set of short logical secret names (e.g. \"jwt-access-secret\", \"resend-api-key\"). Each is prefixed by the module to form '/forethread-backend/<env>/<name>'. Do NOT include the prefix here. The RDS master credential secret is excluded — it's managed by the database-rds module via manage_master_user_password."
  type        = set(string)

  validation {
    condition     = alltrue([for n in var.secret_names : can(regex("^[a-z0-9][a-z0-9-]*[a-z0-9]$", n))])
    error_message = "Each secret name must be lowercase kebab-case (letters, digits, hyphens; no leading/trailing hyphen)."
  }

  validation {
    condition     = alltrue([for n in var.secret_names : !startswith(n, "/")])
    error_message = "Secret names must be short logical names without the '/forethread-backend/<env>/' prefix — the module adds it."
  }
}

variable "recovery_window_days" {
  description = "Soft-delete recovery window for Secrets Manager secrets, in days. Set to 0 for immediate deletion (not recommended in prod). AWS allows 0 or 7-30."
  type        = number
  default     = 30

  validation {
    condition     = var.recovery_window_days == 0 || (var.recovery_window_days >= 7 && var.recovery_window_days <= 30)
    error_message = "recovery_window_days must be 0 (immediate delete) or between 7 and 30."
  }
}

variable "kms_deletion_window_days" {
  description = "Waiting period before the KMS key is irrevocably deleted after `terraform destroy`. AWS allows 7-30."
  type        = number
  default     = 30

  validation {
    condition     = var.kms_deletion_window_days >= 7 && var.kms_deletion_window_days <= 30
    error_message = "kms_deletion_window_days must be between 7 and 30."
  }
}

variable "tags" {
  description = "Standard tag bundle. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
