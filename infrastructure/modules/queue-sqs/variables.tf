variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "queue_names" {
  description = "Set of kebab-case logical queue names (e.g. \"voucher-generation\"). Each entry produces a main queue \"forethread-<env>-<name>\" and a companion DLQ \"forethread-<env>-<name>-dlq\". An empty set creates no queues — useful when SQS is not in use yet."
  type        = set(string)
  default     = []

  validation {
    condition     = alltrue([for n in var.queue_names : can(regex("^[a-z][a-z0-9]*(-[a-z0-9]+)*$", n))])
    error_message = "Each queue_name must be lowercase kebab-case (letters, digits, internal hyphens)."
  }
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout for the main queue. Must be greater than or equal to the longest expected handler runtime so a message is not redelivered while still being processed. Range 0-43200."
  type        = number
  default     = 30

  validation {
    condition     = var.visibility_timeout_seconds >= 0 && var.visibility_timeout_seconds <= 43200
    error_message = "visibility_timeout_seconds must be between 0 and 43200 (12 hours)."
  }
}

variable "message_retention_seconds" {
  description = "How long the main queue retains undelivered messages. Default 4 days. Range 60-1209600."
  type        = number
  default     = 345600

  validation {
    condition     = var.message_retention_seconds >= 60 && var.message_retention_seconds <= 1209600
    error_message = "message_retention_seconds must be between 60 (1 minute) and 1209600 (14 days)."
  }
}

variable "max_receive_count" {
  description = "Number of times a message may be received without being deleted before it is moved to the DLQ. Range 1-1000."
  type        = number
  default     = 5

  validation {
    condition     = var.max_receive_count >= 1 && var.max_receive_count <= 1000
    error_message = "max_receive_count must be between 1 and 1000."
  }
}

variable "dlq_message_retention_seconds" {
  description = "How long the DLQ retains messages. Defaults to the SQS maximum of 14 days for a long forensic window. Range 60-1209600."
  type        = number
  default     = 1209600

  validation {
    condition     = var.dlq_message_retention_seconds >= 60 && var.dlq_message_retention_seconds <= 1209600
    error_message = "dlq_message_retention_seconds must be between 60 (1 minute) and 1209600 (14 days)."
  }
}

variable "tags" {
  description = "Tags applied to every resource created by this module. The module merges in a per-resource Name tag."
  type        = map(string)
  default     = {}
}
