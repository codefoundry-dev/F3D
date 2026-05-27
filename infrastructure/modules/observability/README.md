# modules/observability

CloudWatch log groups, alarms, and an SNS topic that broadcasts formatted alarm notifications via EventBridge.

## What it creates

| Resource | Default thresholds |
|---|---|
| Backend app log group `/forethread-backend/<env>` | 30 day retention |
| Host log group `/forethread-backend/<env>/host` | 30 day retention |
| SNS topic `forethread-<env>-backend-alerts` | Email subscription to `notification_email` |
| EC2 CPU alarm | > 80% for 5 min |
| RDS CPU alarm | > 70% for 10 min |
| RDS free storage alarm | < 2 GiB for 10 min |
| Redis CPU alarm (if `redis_cluster_id` set) | > 70% for 10 min |
| Redis free memory alarm (if `redis_cluster_id` set) | < 50 MiB for 10 min |
| SQS DLQ alarms (one per entry in `sqs_dlq_arns`) | > 0 messages |
| Backend ERROR log metric filter + alarm | > 5 ERRORs / 5 min |

Alarm state changes go through EventBridge → input transformer → SNS so the email is human-readable, not raw JSON.

## Inputs

| Name | Required |
|---|---|
| `env` | yes |
| `notification_email` | yes |
| `ec2_instance_id` | yes |
| `rds_instance_id` | yes |
| `redis_cluster_id` | no (empty disables Redis alarms) |
| `sqs_dlq_arns` | no (empty map disables DLQ alarms) |
