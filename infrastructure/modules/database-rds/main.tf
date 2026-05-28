# Subnet group spans every private subnet the caller passes. RDS requires
# subnets in at least two AZs here even though the instance itself is single-AZ;
# that way a future Multi-AZ flip is just one argument change.
resource "aws_db_subnet_group" "this" {
  name       = "forethread-${var.env}-backend-rds-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-rds-subnet-group"
  })
}

# RDS security group. Rules are attached separately via aws_security_group_rule
# so additional consumers can be granted access without recreating the SG.
# No egress rule — RDS does not need outbound.
resource "aws_security_group" "this" {
  description = "Postgres ingress for forethread-${var.env}-backend-rds. Sources are explicit SGs passed by the caller."
  name        = "forethread-${var.env}-backend-rds-sg"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-rds-sg"
  })
}

# One ingress rule per allowed source SG. `count` instead of `for_each` because
# source SG IDs typically come from another module's resource attribute
# (e.g. module.compute.security_group_id), which is only known after apply.
# `for_each` over apply-time-unknown values fails at plan; `count` with
# `length(...)` works because the list length is known statically.
resource "aws_security_group_rule" "ingress_from_allowed" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  description              = "Postgres 5432 from allowed source SG"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.this.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

# Custom parameter group so we get slow-query and connection logging without
# editing the default group. Family must match the major engine version.
#
# pgaudit is appended to shared_preload_libraries when var.enable_pgaudit is
# true. shared_preload_libraries is a STATIC parameter — the value change is
# applied as pending-reboot, so the operator must reboot the RDS instance for
# pgaudit to load. After reboot, run CREATE EXTENSION pgaudit; once per
# database. pgaudit.log is dynamic — no reboot needed.
resource "aws_db_parameter_group" "this" {
  description = "Parameter group for forethread-${var.env}-backend-rds (PostgreSQL 16). Adds slow-query + connection logging."
  family      = "postgres16"
  name        = "forethread-${var.env}-backend-rds-pg16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  dynamic "parameter" {
    for_each = var.enable_pgaudit ? [1] : []
    content {
      name         = "shared_preload_libraries"
      value        = "pg_stat_statements,pg_tle,pgaudit"
      apply_method = "pending-reboot"
    }
  }

  # write = INSERT/UPDATE/DELETE/TRUNCATE/COPY-into-db, ddl = CREATE/ALTER/DROP,
  # role = GRANT/REVOKE/CREATE-ALTER-DROP ROLE. Deliberately excludes 'read'
  # to keep log volume sane on a high-traffic API.
  dynamic "parameter" {
    for_each = var.enable_pgaudit ? [1] : []
    content {
      name  = "pgaudit.log"
      value = "write,ddl,role"
    }
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-rds-pg16"
  })
}

# Single-AZ Postgres 16 on db.t4g.micro. RDS manages the master password
# through Secrets Manager (manage_master_user_password = true) so Terraform
# never sees or stores it; rotation is RDS-handled.
resource "aws_db_instance" "this" {
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  engine                     = "postgres"
  engine_version             = "16"
  auto_minor_version_upgrade = true
  instance_class             = var.instance_class
  identifier                 = "forethread-${var.env}-backend-rds"
  multi_az                   = false

  db_name  = var.db_name
  username = var.master_username

  # RDS-managed master user secret. master_user_secret_kms_key_id is left unset
  # so RDS uses the AWS-managed aws/secretsmanager key.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [aws_security_group.this.id]
  publicly_accessible    = false
  port                   = 5432

  backup_retention_period = var.backup_retention_days
  backup_window           = var.backup_window
  maintenance_window      = var.maintenance_window
  copy_tags_to_snapshot   = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql"]

  apply_immediately   = false
  deletion_protection = var.deletion_protection

  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "forethread-${var.env}-backend-rds-final"

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-rds"
  })
}
