output "primary_endpoint_address" {
  description = "DNS hostname of the single Redis node. Use to build REDIS_URL (redis://<address>:6379)."
  value       = aws_elasticache_cluster.this.cache_nodes[0].address
}

output "port" {
  description = "TCP port the Redis node listens on."
  value       = aws_elasticache_cluster.this.port
}

output "redis_url" {
  description = "Convenience REDIS_URL value (redis://<host>:<port>). Published to SSM by the env composition for backend consumption."
  value       = "redis://${aws_elasticache_cluster.this.cache_nodes[0].address}:${aws_elasticache_cluster.this.port}"
}

output "security_group_id" {
  description = "ID of the Redis security group. Add ingress from new consumers via the allowed_security_group_ids input."
  value       = aws_security_group.this.id
}

output "cluster_id" {
  description = "ElastiCache cluster ID (the user-visible name like 'forethread-staging-backend-redis')."
  value       = aws_elasticache_cluster.this.cluster_id
}

output "arn" {
  description = "ElastiCache cluster ARN."
  value       = aws_elasticache_cluster.this.arn
}
