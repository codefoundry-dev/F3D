output "secret_arns" {
  description = "Map from short logical name (input key) to full Secrets Manager ARN. Pass to compute-ec2's `secret_arns_to_read` to grant the instance role read access."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "secret_names" {
  description = "Map from short logical name (input key) to the full prefixed secret path '/forethread-backend/<env>/<name>'. Useful for publishing to SSM Parameter Store under /forethread/<env>/secrets/<name>/arn for backend lookup."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.name }
}

output "kms_key_arn" {
  description = "ARN of the KMS key encrypting these secrets. Compute roles that read these secrets must also be granted kms:Decrypt on this key."
  value       = aws_kms_key.this.arn
}

output "kms_key_id" {
  description = "ID of the KMS key encrypting these secrets."
  value       = aws_kms_key.this.key_id
}
