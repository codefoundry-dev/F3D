variable "env" {
  description = "Deployment environment. Must be 'prod' or 'staging'. Used in resource names and tags."
  type        = string

  validation {
    condition     = contains(["prod", "staging"], var.env)
    error_message = "env must be 'prod' or 'staging'."
  }
}

variable "cidr" {
  description = "CIDR block for the VPC. Subnets are derived via cidrsubnet() so a non-default size still produces four /24-style subnets across two AZs."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones the public + private subnets are spread across. Default uses the first two AZs in eu-north-1."
  type        = list(string)
  default     = ["eu-north-1a", "eu-north-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "availability_zones must contain exactly 2 entries (the network layout creates one public + one private subnet per AZ)."
  }
}

variable "tags" {
  description = "Standard tag bundle from the env composition (Project, Environment, ManagedBy, Repository, CostCenter). The module merges a per-resource Name tag on top."
  type        = map(string)
  default     = {}
}
