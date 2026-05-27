output "log_group_name" {
  description = "Name of the backend CloudWatch log group (/forethread-backend/<env>)."
  value       = aws_cloudwatch_log_group.backend.name
}

output "log_group_arn" {
  description = "ARN of the backend CloudWatch log group. Used to grant the EC2 instance role logs:PutLogEvents."
  value       = aws_cloudwatch_log_group.backend.arn
}

output "host_log_group_name" {
  description = "Name of the host-side CloudWatch log group (/forethread-backend/<env>/host)."
  value       = aws_cloudwatch_log_group.host.name
}

output "host_log_group_arn" {
  description = "ARN of the host-side CloudWatch log group. Used to grant the EC2 instance role logs:PutLogEvents."
  value       = aws_cloudwatch_log_group.host.arn
}

output "sns_topic_arn" {
  description = "ARN of the shared alerts SNS topic. EventBridge sends formatted CloudWatch alarm state-change messages to this topic."
  value       = aws_sns_topic.alerts.arn
}

output "alarm_arns" {
  description = "ARNs of every CloudWatch alarm created by this module - useful for IAM policies and audit reporting."
  value       = local.alarm_arns
}
