variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "vpc_id" {
  description = "ID of the VPC the ElastiCache cluster and its security group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the ElastiCache subnet group. Single-node Redis only needs one subnet but two is the convention to make a future Multi-AZ flip a single-input change."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 1
    error_message = "private_subnet_ids must contain at least 1 subnet ID."
  }
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to connect to Redis on port 6379. The caller passes the EC2 backend SG (and any other consumers) explicitly."
  type        = list(string)
}

variable "node_type" {
  description = "ElastiCache node type. cache.t4g.micro (Graviton) keeps cost minimal for single-node Redis."
  type        = string
  default     = "cache.t4g.micro"
}

variable "engine_version" {
  description = "Redis engine version. 7.x lines up with the redis:7-alpine image used in docker-compose."
  type        = string
  default     = "7.1"
}

variable "parameter_group_family" {
  description = "ElastiCache parameter group family. Must match the major Redis version."
  type        = string
  default     = "redis7"
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain automated snapshots. 0 disables snapshots; set 1+ for prod."
  type        = number
  default     = 0
}

variable "snapshot_window" {
  description = "Daily window during which automated snapshots are taken (UTC, hh24:mi-hh24:mi). Ignored when snapshot_retention_limit = 0."
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window in UTC, ddd:hh24:mi-ddd:hh24:mi."
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "apply_immediately" {
  description = "Whether parameter changes are applied immediately. Defaults to false so reboots happen during the maintenance window."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Standard tag bundle from the env composition. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
