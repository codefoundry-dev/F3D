variable "aws_region" {
  description = "AWS region for the staging stack."
  type        = string
  default     = "eu-north-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the staging VPC. Distinct from prod for clean separation."
  type        = string
  default     = "10.10.0.0/16"
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the staging backend. t4g.micro is enough for low-traffic verification."
  type        = string
  default     = "t4g.micro"
}

variable "ec2_root_volume_size_gb" {
  description = "Root EBS volume size on the staging EC2."
  type        = number
  default     = 30
}

variable "rds_instance_class" {
  description = "RDS instance class for staging."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_backup_retention_days" {
  description = "RDS automated backup retention. 7 for staging."
  type        = number
  default     = 7
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type for staging."
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_snapshot_retention_limit" {
  description = "Days of automated Redis snapshots to keep. 0 disables snapshots (fine for staging — cache state is ephemeral)."
  type        = number
  default     = 0
}

variable "domain_name" {
  description = "Public DNS name pointed at the staging backend; Caddy obtains a Let's Encrypt cert for it."
  type        = string
  default     = "api-main.forethread.com"
}

variable "web_app_origin" {
  description = "URL of the staging web frontend allowed to PUT/GET via presigned S3 URLs."
  type        = string
  default     = "https://app-stage.forethread.com"
}

variable "notification_email" {
  description = "Email subscribed to the SNS alerts topic."
  type        = string
}

variable "queue_names" {
  description = "Logical SQS queue names. Empty by default."
  type        = set(string)
  default     = []
}

variable "secret_names" {
  description = "Logical secret slot names. Same set as prod; staging values are populated independently."
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
