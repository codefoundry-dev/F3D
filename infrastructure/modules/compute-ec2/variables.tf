variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'. Used in resource names and tags."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "vpc_id" {
  description = "ID of the VPC the EC2 instance and its security group live in."
  type        = string
}

variable "public_subnet_id" {
  description = "Public subnet ID the EC2 instance is launched into. Single-AZ for v1."
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type. Default t4g.small (Graviton/ARM64) for prod; pass t4g.micro for staging."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size in GiB."
  type        = number
  default     = 30
}

variable "root_volume_type" {
  description = "Root EBS volume type."
  type        = string
  default     = "gp3"
}

variable "secret_arns_to_read" {
  description = "Secrets Manager secret ARNs the EC2 instance is granted secretsmanager:GetSecretValue on. The RDS master secret ARN is added to this set automatically; do not include it here."
  type        = list(string)
  default     = []
}

variable "kms_key_arns_to_decrypt" {
  description = "KMS key ARNs the EC2 instance is granted kms:Decrypt on. Required when secrets are encrypted with customer-managed keys."
  type        = list(string)
  default     = []
}

variable "sqs_queue_arns" {
  description = "SQS queue ARNs the EC2 instance may send/receive on. Pass main queues only; DLQs excluded — the backend never writes to its own DLQs."
  type        = list(string)
  default     = []
}

variable "s3_bucket_arns" {
  description = "S3 bucket ARNs the EC2 instance may read/write objects on. The backend (apps/backend) uses these for the uploads bucket via @aws-sdk/client-s3. Pass each bucket ARN once; the policy expands to both the bucket and its objects."
  type        = list(string)
  default     = []
}

variable "rds_master_secret_arn" {
  description = "ARN of the RDS-managed master user secret in Secrets Manager. Always granted to the instance role so the backend can fetch the DB password at boot."
  type        = string
}

variable "rds_security_group_id" {
  description = "ID of the RDS security group. Accepted to make the cross-module dependency explicit; the SG-to-SG ingress is created on the RDS side via its allowed_security_group_ids input."
  type        = string
}

variable "redis_security_group_id" {
  description = "ID of the Redis security group. Same convention as rds_security_group_id — the actual ingress rule lives on the cache-redis module side."
  type        = string
  default     = ""
}

variable "log_group_name" {
  description = "Name of the backend application CloudWatch log group. Created by the observability module."
  type        = string
}

variable "host_log_group_name" {
  description = "Name of the host-side CloudWatch log group for Caddy access logs and system messages."
  type        = string
}

variable "app_port" {
  description = "TCP port the NestJS container listens on internally. Caddy reverse-proxies 443 to this port."
  type        = number
  default     = 3000
}

variable "domain_name" {
  description = "Public DNS name pointed at the instance. When non-empty, Caddy obtains a real TLS cert from Let's Encrypt via HTTP-01. When empty, Caddy serves plain HTTP on port 80."
  type        = string
  default     = ""
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store prefix the backend reads its config from. Used both as the IAM policy scope and surfaced into user_data."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Standard tag bundle from the env composition. The module merges per-resource Name and Project tags on top."
  type        = map(string)
  default     = {}
}
