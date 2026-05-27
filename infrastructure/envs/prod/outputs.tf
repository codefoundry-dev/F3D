output "vpc_id" {
  description = "Prod VPC ID."
  value       = module.network.vpc_id
}

output "ec2_instance_id" {
  description = "Prod backend EC2 instance ID."
  value       = module.compute.instance_id
}

output "ec2_public_ip" {
  description = "Stable Elastic IPv4 address. Point the DNS A record at this."
  value       = module.compute.public_ip
}

output "ec2_public_dns" {
  description = "AWS-assigned public DNS for the prod backend Elastic IP."
  value       = module.compute.public_dns
}

output "ec2_elastic_ip_allocation_id" {
  description = "Elastic IP allocation ID for the prod backend."
  value       = module.compute.elastic_ip_allocation_id
}

output "ecr_repository_url" {
  description = "ECR repo URL the deploy workflow pushes to."
  value       = module.compute.ecr_repository_url
}

output "rds_endpoint" {
  description = "RDS endpoint."
  value       = module.database.endpoint
}

output "rds_master_secret_arn" {
  description = "ARN of the RDS-managed master user secret."
  value       = module.database.master_secret_arn
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint hostname."
  value       = module.cache.primary_endpoint_address
}

output "redis_url" {
  description = "REDIS_URL value for the backend."
  value       = module.cache.redis_url
}

output "s3_uploads_bucket" {
  description = "Name of the S3 uploads bucket."
  value       = module.storage.bucket_name
}

output "secret_arns" {
  description = "Map of app secret name to ARN. Values are NOT in the output."
  value       = module.secrets.secret_arns
}

output "queue_arns" {
  description = "Map of SQS queue name to ARN."
  value       = module.queues.queue_arns
}

output "sns_alerts_topic_arn" {
  description = "SNS topic that receives all CloudWatch alarms for prod."
  value       = module.observability.sns_topic_arn
}

output "log_group_name" {
  description = "CloudWatch log group for prod backend logs."
  value       = module.observability.log_group_name
}
