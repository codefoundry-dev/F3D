output "endpoint" {
  description = "Connection endpoint in host:port form, suitable for libpq DATABASE_URL construction."
  value       = aws_db_instance.this.endpoint
}

output "address" {
  description = "DNS hostname of the instance (no port)."
  value       = aws_db_instance.this.address
}

output "port" {
  description = "TCP port the instance listens on."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Initial database name created on the instance."
  value       = aws_db_instance.this.db_name
}

output "master_secret_arn" {
  description = "ARN of the RDS-managed master user secret in Secrets Manager. The backend reads the password from here at boot."
  value       = aws_db_instance.this.master_user_secret[0].secret_arn
}

output "security_group_id" {
  description = "ID of the RDS security group. Add ingress from new consumers via the allowed_security_group_ids input on the module."
  value       = aws_security_group.this.id
}

output "instance_id" {
  description = "RDS instance identifier (the user-set name). NOT the DbiResourceId — CloudWatch metric dimensions key off this."
  value       = aws_db_instance.this.identifier
}

output "instance_arn" {
  description = "RDS instance ARN."
  value       = aws_db_instance.this.arn
}

output "parameter_group_name" {
  description = "Name of the custom DB parameter group attached to the instance."
  value       = aws_db_parameter_group.this.name
}
