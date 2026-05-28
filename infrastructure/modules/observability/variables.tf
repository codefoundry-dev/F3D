variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'. Used in resource names and tags."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "log_retention_days" {
  description = "Retention in days for the backend CloudWatch log group. Defaults to 30 (overrides AWS's 'never expire' default)."
  type        = number
  default     = 30
}

variable "notification_email" {
  description = "Email address subscribed to the alerts SNS topic. AWS sends a confirmation email on first apply; the subscription stays in 'pending confirmation' until the recipient clicks the link."
  type        = string
}

variable "ec2_instance_id" {
  description = "EC2 instance ID of the backend host. Used as the InstanceId dimension on the EC2 CPU alarm."
  type        = string
}

variable "rds_instance_id" {
  description = "RDS instance identifier (the `aws_db_instance.id` value, not the ARN). Used as the DBInstanceIdentifier dimension on the RDS CPU and free-storage alarms."
  type        = string
}

variable "redis_cluster_id" {
  description = "ElastiCache Redis cluster ID. Used as the CacheClusterId dimension on the Redis CPU and memory alarms. Set to empty string to disable Redis alarms."
  type        = string
  default     = ""
}

variable "rds_free_storage_threshold_bytes" {
  description = "Threshold in bytes below which the RDS free-storage alarm fires. Default 2 GiB."
  type        = number
  default     = 2147483648
}

variable "sqs_dlq_arns" {
  description = "Map of short-name -> DLQ ARN. One 'DLQ has messages' alarm is created per entry. Empty map disables DLQ alarms."
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Standard tag bundle from the env composition. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
