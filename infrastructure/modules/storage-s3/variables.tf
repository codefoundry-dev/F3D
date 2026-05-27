variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "bucket_name" {
  description = "Name of the uploads bucket. Defaults to forethread-<env>-uploads. Override if a globally-unique name is needed (S3 bucket names are global)."
  type        = string
  default     = ""
}

variable "cors_allowed_origins" {
  description = "Origins permitted to upload directly via presigned URLs. Pass the env's web app URL (e.g. https://app.forethread.com). Empty list disables CORS entirely (server-side uploads only)."
  type        = list(string)
  default     = []
}

variable "noncurrent_version_expiration_days" {
  description = "Number of days after which non-current object versions are deleted. Versioning is enabled so accidental overwrites/deletions are recoverable for this window."
  type        = number
  default     = 90
}

variable "tags" {
  description = "Standard tag bundle from the env composition. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
