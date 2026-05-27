output "instance_id" {
  description = "EC2 instance ID. Published to SSM under <ssm_prefix>/ec2/backend/instance-id by the env composition so deploy workflows can target it."
  value       = aws_instance.this.id
}

output "instance_arn" {
  description = "EC2 instance ARN."
  value       = aws_instance.this.arn
}

output "public_ip" {
  description = "Stable Elastic IPv4 address for the backend. Point the env's DNS A record at this."
  value       = aws_eip.this.public_ip
}

output "public_dns" {
  description = "Public DNS name AWS assigns to the Elastic IP. Convenient for ad-hoc curl checks."
  value       = aws_eip.this.public_dns
}

output "elastic_ip_allocation_id" {
  description = "Elastic IP allocation ID associated with the backend EC2 instance."
  value       = aws_eip.this.allocation_id
}

output "security_group_id" {
  description = "ID of the EC2 security group. Pass this to the database-rds and cache-redis modules' allowed_security_group_ids inputs."
  value       = aws_security_group.this.id
}

output "instance_role_arn" {
  description = "ARN of the EC2 instance role."
  value       = aws_iam_role.this.arn
}

output "instance_role_name" {
  description = "Name of the EC2 instance role."
  value       = aws_iam_role.this.name
}

output "instance_profile_name" {
  description = "Name of the IAM instance profile attached to the instance."
  value       = aws_iam_instance_profile.this.name
}

output "ecr_repository_url" {
  description = "ECR repository URL the deploy workflow pushes to. Also published to SSM."
  value       = aws_ecr_repository.this.repository_url
}

output "ecr_repository_arn" {
  description = "ECR repository ARN."
  value       = aws_ecr_repository.this.arn
}
