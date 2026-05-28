locals {
  log_group_name         = "/forethread-backend/${var.env}"
  host_log_group_name    = "/forethread-backend/${var.env}/host"
  error_metric_name      = "forethread-${var.env}-backend-error-count"
  error_metric_namespace = "forethread/backend"
}

data "aws_caller_identity" "current" {}

# Backend application log group. 30-day retention overrides AWS's 'never
# expire' default and caps log spend.
resource "aws_cloudwatch_log_group" "backend" {
  name              = local.log_group_name
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-log-group"
  })
}

# Host-side logs live outside the backend app log group so proxy scans and
# system daemon noise cannot increment backend ERROR-rate metrics.
resource "aws_cloudwatch_log_group" "host" {
  name              = local.host_log_group_name
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-host-log-group"
  })
}

# One shared SNS topic for every alarm in this env.
resource "aws_sns_topic" "alerts" {
  name = "forethread-${var.env}-backend-alerts"

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-alerts"
  })
}

# Email subscription. AWS sends a confirmation email on first apply; the
# subscription is "pending confirmation" until the recipient clicks the link.
resource "aws_sns_topic_subscription" "alerts_email" {
  endpoint  = var.notification_email
  protocol  = "email"
  topic_arn = aws_sns_topic.alerts.arn
}

# EC2 CPU > 80% for 5 minutes.
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "forethread-${var.env}-ec2-cpu-high-alarm"
  alarm_description   = "EC2 backend host CPUUtilization above 80% for 5 minutes."
  namespace           = "AWS/EC2"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = var.ec2_instance_id
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-ec2-cpu-high-alarm"
  })
}

# RDS CPU > 70% for 10 minutes.
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "forethread-${var.env}-rds-cpu-high-alarm"
  alarm_description   = "RDS backend instance CPUUtilization above 70% for 10 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 70
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-rds-cpu-high-alarm"
  })
}

# RDS free storage below threshold for 10 minutes.
resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "forethread-${var.env}-rds-free-storage-low-alarm"
  alarm_description   = "RDS backend instance FreeStorageSpace below ${var.rds_free_storage_threshold_bytes} bytes for 10 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = var.rds_free_storage_threshold_bytes
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DBInstanceIdentifier = var.rds_instance_id
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-rds-free-storage-low-alarm"
  })
}

# ElastiCache CPU > 70% for 10 minutes. Only created when redis_cluster_id is
# non-empty (so the module can be reused in envs without Redis).
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  count = var.redis_cluster_id != "" ? 1 : 0

  alarm_name          = "forethread-${var.env}-redis-cpu-high-alarm"
  alarm_description   = "ElastiCache Redis CPUUtilization above 70% for 10 minutes."
  namespace           = "AWS/ElastiCache"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 70
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-redis-cpu-high-alarm"
  })
}

# ElastiCache free memory low (< 50 MiB for 10 minutes).
resource "aws_cloudwatch_metric_alarm" "redis_memory_low" {
  count = var.redis_cluster_id != "" ? 1 : 0

  alarm_name          = "forethread-${var.env}-redis-memory-low-alarm"
  alarm_description   = "ElastiCache Redis FreeableMemory below 50 MiB for 10 minutes."
  namespace           = "AWS/ElastiCache"
  metric_name         = "FreeableMemory"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  datapoints_to_alarm = 2
  threshold           = 52428800 # 50 MiB
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    CacheClusterId = var.redis_cluster_id
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-redis-memory-low-alarm"
  })
}

# One DLQ-has-messages alarm per entry in var.sqs_dlq_arns. QueueName dimension
# is extracted from the ARN (arn:aws:sqs:<region>:<account>:<queue-name> ->
# index 5 after splitting on ":"). Threshold is 0 — any message visible in a
# DLQ should page someone.
resource "aws_cloudwatch_metric_alarm" "sqs_dlq_has_messages" {
  for_each = var.sqs_dlq_arns

  alarm_name          = "forethread-${var.env}-sqs-${each.key}-dlq-alarm"
  alarm_description   = "DLQ ${each.key} has visible messages - investigate the producer."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = split(":", each.value)[5]
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-sqs-${each.key}-dlq-alarm"
  })
}

# ERROR-level log metric filter. CloudWatch term-OR pattern matches plain
# "ERROR"/"error"/"Error" lines AND structured JSON logs (which always include
# the substring "error" in {"level":"error",...}).
resource "aws_cloudwatch_log_metric_filter" "backend_errors" {
  name           = local.error_metric_name
  log_group_name = aws_cloudwatch_log_group.backend.name
  pattern        = "?ERROR ?error ?Error"

  metric_transformation {
    name          = local.error_metric_name
    namespace     = local.error_metric_namespace
    value         = "1"
    default_value = "0"
  }
}

# Companion alarm: more than 5 ERROR-level log lines in a 5-minute window.
resource "aws_cloudwatch_metric_alarm" "backend_errors_high" {
  alarm_name          = "forethread-${var.env}-backend-error-rate-alarm"
  alarm_description   = "Backend ERROR-level log lines exceeded 5 in a 5-minute window."
  namespace           = local.error_metric_namespace
  metric_name         = local.error_metric_name
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  datapoints_to_alarm = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-error-rate-alarm"
  })
}

locals {
  alarm_arns = concat(
    [
      aws_cloudwatch_metric_alarm.ec2_cpu_high.arn,
      aws_cloudwatch_metric_alarm.rds_cpu_high.arn,
      aws_cloudwatch_metric_alarm.rds_free_storage_low.arn,
      aws_cloudwatch_metric_alarm.backend_errors_high.arn,
    ],
    [for alarm in aws_cloudwatch_metric_alarm.redis_cpu_high : alarm.arn],
    [for alarm in aws_cloudwatch_metric_alarm.redis_memory_low : alarm.arn],
    [for alarm in aws_cloudwatch_metric_alarm.sqs_dlq_has_messages : alarm.arn],
  )
}

# CloudWatch alarm direct-to-SNS emails are raw JSON and hard to scan during an
# incident. CloudWatch emits alarm state changes to EventBridge; we format
# those events here and send the readable message to the existing topic.
resource "aws_cloudwatch_event_rule" "alarm_state_notifications" {
  name        = "forethread-${var.env}-alarm-state-notifications"
  description = "Formats CloudWatch alarm state changes into readable SNS email content."

  event_pattern = jsonencode({
    source        = ["aws.cloudwatch"]
    "detail-type" = ["CloudWatch Alarm State Change"]
    resources     = local.alarm_arns
    detail = {
      state = {
        value = ["ALARM", "OK"]
      }
    }
  })

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-alarm-state-notifications"
  })
}

resource "aws_cloudwatch_event_target" "alarm_state_notifications_sns" {
  rule      = aws_cloudwatch_event_rule.alarm_state_notifications.name
  target_id = "send-readable-alarm-email"
  arn       = aws_sns_topic.alerts.arn

  input_transformer {
    input_paths = {
      account           = "$.account"
      alarm_arn         = "$.resources[0]"
      alarm_description = "$.detail.configuration.description"
      alarm_name        = "$.detail.alarmName"
      new_state         = "$.detail.state.value"
      previous_state    = "$.detail.previousState.value"
      reason            = "$.detail.state.reason"
      region            = "$.region"
      time              = "$.time"
    }

    input_template = "\"Forethread CloudWatch alarm\\n\\nEnvironment: ${var.env}\\nAlarm: <alarm_name>\\nState: <previous_state> -> <new_state>\\nTime: <time>\\nRegion: <region>\\nAccount: <account>\\n\\nDescription:\\n<alarm_description>\\n\\nReason:\\n<reason>\\n\\nAlarm ARN:\\n<alarm_arn>\\n\\nCloudWatch:\\nhttps://<region>.console.aws.amazon.com/cloudwatch/home?region=<region>#alarmsV2:alarm/<alarm_name>\""
  }
}

data "aws_iam_policy_document" "alerts_topic" {
  statement {
    sid    = "__default_statement_ID"
    effect = "Allow"

    actions = [
      "SNS:AddPermission",
      "SNS:DeleteTopic",
      "SNS:GetTopicAttributes",
      "SNS:ListSubscriptionsByTopic",
      "SNS:Publish",
      "SNS:Receive",
      "SNS:RemovePermission",
      "SNS:SetTopicAttributes",
      "SNS:Subscribe",
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceOwner"
      values   = [data.aws_caller_identity.current.account_id]
    }

    principals {
      type        = "AWS"
      identifiers = ["*"]
    }

    resources = [aws_sns_topic.alerts.arn]
  }

  statement {
    sid    = "AllowEventBridgeAlarmNotifications"
    effect = "Allow"

    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.alerts.arn]

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.alarm_state_notifications.arn]
    }

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.alerts_topic.json
}
