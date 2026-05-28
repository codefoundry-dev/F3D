output "queue_arns" {
  description = "ARNs of the main queues, keyed by short (kebab-case) name."
  value       = { for k, q in aws_sqs_queue.main : k => q.arn }
}

output "queue_urls" {
  description = "URLs of the main queues, keyed by short (kebab-case) name."
  value       = { for k, q in aws_sqs_queue.main : k => q.url }
}

output "queue_names" {
  description = "Full AWS queue names of the main queues, keyed by short (kebab-case) name."
  value       = { for k, q in aws_sqs_queue.main : k => q.name }
}

output "dlq_arns" {
  description = "ARNs of the dead-letter queues, keyed by short (kebab-case) name."
  value       = { for k, q in aws_sqs_queue.dlq : k => q.arn }
}

output "dlq_urls" {
  description = "URLs of the dead-letter queues, keyed by short (kebab-case) name."
  value       = { for k, q in aws_sqs_queue.dlq : k => q.url }
}
