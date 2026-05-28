variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'. Used in resource names and tags."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "vpc_id" {
  description = "ID of the VPC the RDS instance and its security group live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB subnet group. RDS requires at least two subnets in different AZs even for single-AZ instances."
  type        = list(string)

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "private_subnet_ids must contain at least 2 subnet IDs (RDS subnet groups require multiple AZs even for single-AZ instances)."
  }
}

variable "allowed_security_group_ids" {
  description = "Security group IDs that are allowed to connect to Postgres on port 5432. The caller passes the EC2 backend SG (and any other consumers) explicitly — the module does not infer them."
  type        = list(string)
}

variable "db_name" {
  description = "Initial database name created on the instance."
  type        = string
  default     = "forethread"
}

variable "master_username" {
  description = "Master username. The password is generated and rotated by RDS via Secrets Manager (manage_master_user_password = true) — Terraform never sees it."
  type        = string
  default     = "forethread_admin"
}

variable "instance_class" {
  description = "RDS instance class. Default db.t4g.micro (Graviton). Override to db.t4g.small / .medium for prod when load warrants."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Initial gp3 storage in GiB. Online resize is supported, so start small."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Storage autoscaling ceiling in GiB. RDS automatically grows allocated_storage up to this value."
  type        = number
  default     = 100
}

variable "backup_retention_days" {
  description = "Automated backup retention in days. Caller passes 30 for prod and 7 for staging."
  type        = number
}

variable "backup_window" {
  description = "Daily backup window in UTC, hh24:mi-hh24:mi."
  type        = string
  default     = "02:00-03:00"
}

variable "maintenance_window" {
  description = "Weekly maintenance window in UTC, ddd:hh24:mi-ddd:hh24:mi."
  type        = string
  default     = "sun:03:00-sun:04:00"
}

variable "deletion_protection" {
  description = "Whether the instance has deletion protection enabled. Defaults to true; flip to false only when intentionally tearing the env down."
  type        = bool
  default     = true
}

variable "skip_final_snapshot" {
  description = "Whether to skip the final snapshot at destroy time. Defaults to false so an accidental destroy still leaves a recoverable snapshot."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Standard tag bundle from the env composition. The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}

variable "enable_pgaudit" {
  description = "Enable the pgaudit extension on the parameter group. When true, appends 'pgaudit' to shared_preload_libraries (static — requires an RDS reboot to take effect) and sets pgaudit.log = 'write,ddl,role'. After the reboot, run CREATE EXTENSION pgaudit; once per database."
  type        = bool
  default     = false
}
