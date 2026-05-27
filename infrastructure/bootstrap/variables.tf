variable "region" {
  description = "AWS region for the state backend resources."
  type        = string
  default     = "eu-north-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket that stores Terraform state for all envs."
  type        = string
  default     = "forethread-tfstate-eu-north-1"
}

variable "lock_table_name" {
  description = "Name of the DynamoDB table used for state locking."
  type        = string
  default     = "forethread-tfstate-lock"
}

variable "kms_key_alias" {
  description = "Alias of the KMS key that encrypts state at rest."
  type        = string
  default     = "alias/forethread-tfstate"
}
