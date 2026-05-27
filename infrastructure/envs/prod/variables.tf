variable "aws_region" {
  description = "AWS region for the prod stack."
  type        = string
  default     = "eu-north-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the prod VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the backend host. Graviton (ARM64). t4g.small is the smallest size that comfortably runs the NestJS image + Caddy."
  type        = string
  default     = "t4g.small"
}

variable "ec2_root_volume_size_gb" {
  description = "Root EBS volume size on the backend EC2."
  type        = number
  default     = 30
}

variable "rds_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_backup_retention_days" {
  description = "RDS automated backup retention in days. 30 for prod."
  type        = number
  default     = 30
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_snapshot_retention_limit" {
  description = "Days of automated Redis snapshots to keep. 1 for prod gives same-day recoverability."
  type        = number
  default     = 1
}

variable "domain_name" {
  description = "Public DNS name pointed at the prod backend. Caddy obtains a real Let's Encrypt cert via HTTP-01 when set."
  type        = string
  default     = "api.forethread.com"
}

variable "web_app_origin" {
  description = "URL of the web frontend allowed to PUT/GET via presigned S3 URLs. Used to set CORS on the uploads bucket."
  type        = string
  default     = "https://app.forethread.com"
}

variable "notification_email" {
  description = "Email subscribed to the SNS alerts topic. Confirm the AWS subscription email after first apply or alarms will not deliver."
  type        = string
}

variable "queue_names" {
  description = "Logical SQS queue names (kebab-case). Each gets a companion DLQ. Default is empty — add names when workers come online."
  type        = set(string)
  default     = []
}

variable "secret_names" {
  description = "Logical secret slot names. Values are populated out-of-band; see modules/secrets/README.md."
  type        = set(string)
  default = [
    "jwt-access-secret",
    "jwt-refresh-secret",
    "resend-api-key",
    "gemini-api-key",
    "google-places-api-key",
    "sentry-dsn",
  ]
}
