# Dead-letter queues. Created first so the main queues can reference their ARNs
# in the redrive policy. DLQ retention is intentionally longer than the main
# queue so operators have a forensic window to inspect failed messages.
resource "aws_sqs_queue" "dlq" {
  for_each = var.queue_names

  name                      = "forethread-${var.env}-${each.value}-dlq"
  message_retention_seconds = var.dlq_message_retention_seconds
  sqs_managed_sse_enabled   = true

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-${each.value}-dlq"
  })
}

# Main queues. Standard (at-least-once). Each queue is paired with the DLQ
# keyed by the same short name; messages are moved to the DLQ after
# `max_receive_count` receives without a successful delete.
resource "aws_sqs_queue" "main" {
  for_each = var.queue_names

  name                       = "forethread-${var.env}-${each.value}"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq[each.key].arn
    maxReceiveCount     = var.max_receive_count
  })

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-${each.value}"
  })
}
