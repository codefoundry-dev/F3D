locals {
  env = "staging"

  tags = {
    Project     = "forethread"
    Environment = local.env
    ManagedBy   = "terraform"
    Repository  = "f3d"
    CostCenter  = "forethread-backend"
  }

  ssm_prefix = "/forethread/${local.env}"
}

module "network" {
  source = "../../modules/network"

  env  = local.env
  cidr = var.vpc_cidr
  tags = local.tags
}

module "secrets" {
  source = "../../modules/secrets"

  env          = local.env
  secret_names = var.secret_names
  tags         = local.tags
}

module "queues" {
  source = "../../modules/queue-sqs"

  env         = local.env
  queue_names = var.queue_names
  tags        = local.tags
}

module "database" {
  source = "../../modules/database-rds"

  env                        = local.env
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.compute.security_group_id]
  instance_class             = var.rds_instance_class
  backup_retention_days      = var.rds_backup_retention_days
  enable_pgaudit             = true
  tags                       = local.tags
}

module "cache" {
  source = "../../modules/cache-redis"

  env                        = local.env
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.compute.security_group_id]
  node_type                  = var.redis_node_type
  snapshot_retention_limit   = var.redis_snapshot_retention_limit
  tags                       = local.tags
}

module "storage" {
  source = "../../modules/storage-s3"

  env                  = local.env
  cors_allowed_origins = [var.web_app_origin]
  tags                 = local.tags
}

module "compute" {
  source = "../../modules/compute-ec2"

  env    = local.env
  vpc_id = module.network.vpc_id
  # public_subnet_ids is ordered [eu-north-1a, eu-north-1b]. Pinned to [0] (1a).
  # t4g.micro capacity in eu-north-1 bounces between AZs: 1a ran dry on
  # 2026-06-02 (moved to 1b), then 1b ran dry on 2026-06-05 — the On-Demand
  # Capacity Reservation below went `failed` and the apply couldn't launch — so
  # the box was moved back to 1a. This AZ ping-pong is the known single-AZ
  # fragility; the durable answer is a multi-AZ ASG with a mixed-instance policy.
  # The reservation + create_before_destroy still help (hold capacity once
  # acquired; never tear down the running box on a starved replace), but a
  # reservation cannot manufacture capacity during a region-wide micro crunch —
  # hence the manual AZ flip when the pinned AZ is starved. If both AZs are dry,
  # bump ec2_instance_type to t4g.small (deeper pool) until micro frees up.
  public_subnet_id = module.network.public_subnet_ids[0]
  # Pin the AMI so routine applies never silently rebuild the box on a new Amazon
  # AL2023 release (this is the AMI the running instance was validated on). Roll
  # deliberately: bump this value, then `terraform apply` (lifecycle ignores ami
  # drift, so a change here is picked up only on create/taint).
  ami_id        = "ami-014049af4c3409183"
  instance_type = var.ec2_instance_type
  # Temporarily false during the 2026-06-05 capacity-crunch recovery: with no
  # t4g.micro free in 1b, a reservation create just hangs/fails and blocks the
  # apply. Recover the instance first (1a), then flip back to true — an "open"
  # reservation attaches to the already-running box without a restart.
  enable_capacity_reservation = false
  root_volume_size_gb         = var.ec2_root_volume_size_gb
  app_port                    = 3000
  domain_name                 = var.domain_name
  ssm_parameter_prefix        = local.ssm_prefix
  log_group_name              = module.observability.log_group_name
  host_log_group_name         = module.observability.host_log_group_name

  secret_arns_to_read     = values(module.secrets.secret_arns)
  kms_key_arns_to_decrypt = [module.secrets.kms_key_arn]
  sqs_queue_arns          = values(module.queues.queue_arns)
  s3_bucket_arns          = [module.storage.bucket_arn]

  rds_master_secret_arn   = module.database.master_secret_arn
  rds_security_group_id   = module.database.security_group_id
  redis_security_group_id = module.cache.security_group_id

  tags = local.tags
}

module "observability" {
  source = "../../modules/observability"

  env                = local.env
  notification_email = var.notification_email
  ec2_instance_id    = module.compute.instance_id
  rds_instance_id    = module.database.instance_id
  redis_cluster_id   = module.cache.cluster_id
  sqs_dlq_arns       = module.queues.dlq_arns
  tags               = local.tags
}

# Cross-repo contract - publish stable ARNs under /forethread/<env>/*

resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "${local.ssm_prefix}/rds/endpoint"
  description = "RDS endpoint host:port for the ${local.env} backend."
  type        = "String"
  value       = module.database.endpoint
  tags        = local.tags
}

resource "aws_ssm_parameter" "rds_port" {
  name        = "${local.ssm_prefix}/rds/port"
  description = "RDS Postgres port."
  type        = "String"
  value       = tostring(module.database.port)
  tags        = local.tags
}

resource "aws_ssm_parameter" "rds_db_name" {
  name        = "${local.ssm_prefix}/rds/db-name"
  description = "RDS Postgres database name."
  type        = "String"
  value       = module.database.db_name
  tags        = local.tags
}

resource "aws_ssm_parameter" "rds_master_secret_arn" {
  name        = "${local.ssm_prefix}/rds/master-secret-arn"
  description = "ARN of the RDS-managed master user secret in Secrets Manager."
  type        = "String"
  value       = module.database.master_secret_arn
  tags        = local.tags
}

resource "aws_ssm_parameter" "redis_url" {
  name        = "${local.ssm_prefix}/redis/url"
  description = "REDIS_URL value for the ${local.env} backend."
  type        = "String"
  value       = module.cache.redis_url
  tags        = local.tags
}

resource "aws_ssm_parameter" "s3_uploads_bucket" {
  name        = "${local.ssm_prefix}/s3/uploads/bucket"
  description = "S3 uploads bucket name."
  type        = "String"
  value       = module.storage.bucket_name
  tags        = local.tags
}

resource "aws_ssm_parameter" "s3_region" {
  name        = "${local.ssm_prefix}/s3/uploads/region"
  description = "AWS region the uploads bucket lives in."
  type        = "String"
  value       = var.aws_region
  tags        = local.tags
}

resource "aws_ssm_parameter" "ecr_repository_url" {
  name        = "${local.ssm_prefix}/ecr/backend/repository-url"
  description = "ECR repository URL the deploy workflow pushes images to."
  type        = "String"
  value       = module.compute.ecr_repository_url
  tags        = local.tags
}

resource "aws_ssm_parameter" "ec2_instance_id" {
  name        = "${local.ssm_prefix}/ec2/backend/instance-id"
  description = "EC2 instance ID the deploy workflow targets via SSM SendCommand."
  type        = "String"
  value       = module.compute.instance_id
  tags        = local.tags
}

resource "aws_ssm_parameter" "queue_arns" {
  for_each = module.queues.queue_arns

  name        = "${local.ssm_prefix}/sqs/${each.key}/arn"
  description = "ARN of the ${each.key} SQS queue."
  type        = "String"
  value       = each.value
  tags        = local.tags
}

resource "aws_ssm_parameter" "queue_urls" {
  for_each = module.queues.queue_urls

  name        = "${local.ssm_prefix}/sqs/${each.key}/url"
  description = "URL of the ${each.key} SQS queue."
  type        = "String"
  value       = each.value
  tags        = local.tags
}

resource "aws_ssm_parameter" "secret_arns" {
  for_each = module.secrets.secret_arns

  name        = "${local.ssm_prefix}/secrets/${each.key}/arn"
  description = "ARN of the ${each.key} app secret in Secrets Manager."
  type        = "String"
  value       = each.value
  tags        = local.tags
}

resource "aws_ssm_parameter" "log_group_name" {
  name        = "${local.ssm_prefix}/observability/log-group-name"
  description = "CloudWatch log group the backend writes to."
  type        = "String"
  value       = module.observability.log_group_name
  tags        = local.tags
}
