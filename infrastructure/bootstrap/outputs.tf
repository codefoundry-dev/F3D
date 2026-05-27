output "state_bucket_name" {
  description = "Name of the S3 bucket holding Terraform state. Reference in env backend configs."
  value       = aws_s3_bucket.tfstate.bucket
}

output "lock_table_name" {
  description = "Name of the DynamoDB lock table. Reference in env backend configs."
  value       = aws_dynamodb_table.lock.name
}

output "kms_key_arn" {
  description = "KMS key ARN protecting state at rest."
  value       = aws_kms_key.tfstate.arn
}

output "region" {
  description = "AWS region the bootstrap resources live in."
  value       = var.region
}
