# Subnet group for ElastiCache. Lives entirely in private subnets.
resource "aws_elasticache_subnet_group" "this" {
  name       = "forethread-${var.env}-backend-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-redis-subnet-group"
  })
}

# Redis security group. Rules attached separately so consumers can be added
# without recreating the SG. No egress — Redis does not need outbound.
resource "aws_security_group" "this" {
  description = "Redis ingress for forethread-${var.env}-backend-redis. Sources are explicit SGs passed by the caller."
  name        = "forethread-${var.env}-backend-redis-sg"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-redis-sg"
  })
}

# One ingress rule per allowed source SG. Same `count` reasoning as
# modules/database-rds — source IDs are apply-time-unknown.
resource "aws_security_group_rule" "ingress_from_allowed" {
  count = length(var.allowed_security_group_ids)

  type                     = "ingress"
  description              = "Redis 6379 from allowed source SG"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.this.id
  source_security_group_id = var.allowed_security_group_ids[count.index]
}

# Parameter group. The default is fine for v1; this exists so future tuning
# (e.g. maxmemory-policy) lands without recreating the cluster.
resource "aws_elasticache_parameter_group" "this" {
  description = "Parameter group for forethread-${var.env}-backend-redis."
  family      = var.parameter_group_family
  name        = "forethread-${var.env}-backend-redis-${replace(var.parameter_group_family, ".", "")}"

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-redis-pg"
  })
}

# Single-node Redis cluster. ElastiCache requires either `cluster_mode=disabled`
# replication groups OR raw cache clusters for single-node use; we use the
# cache cluster form because the backend uses a single REDIS_URL and does not
# need replicas at v1.
resource "aws_elasticache_cluster" "this" {
  cluster_id           = "forethread-${var.env}-backend-redis"
  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = aws_elasticache_parameter_group.this.name
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.this.name
  security_group_ids = [aws_security_group.this.id]

  snapshot_retention_limit = var.snapshot_retention_limit
  snapshot_window          = var.snapshot_retention_limit > 0 ? var.snapshot_window : null
  maintenance_window       = var.maintenance_window
  apply_immediately        = var.apply_immediately

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-redis"
  })
}
