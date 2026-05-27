# modules/queue-sqs

For each name in `queue_names`, creates an SQS Standard main queue + a companion DLQ. f3d does not have SQS consumers wired up yet, so `queue_names` defaults to **empty** — pass an explicit list per env when workers come online.

## Inputs

| Name | Default |
|---|---|
| `env` | required |
| `queue_names` | `[]` |
| `visibility_timeout_seconds` | `30` |
| `message_retention_seconds` | `345600` (4 days) |
| `max_receive_count` | `5` |
| `dlq_message_retention_seconds` | `1209600` (14 days) |

## Outputs

| Name | Description |
|---|---|
| `queue_arns` / `queue_urls` / `queue_names` | Maps keyed by short name |
| `dlq_arns` / `dlq_urls` | Maps keyed by short name |

## Adding a queue

Edit the `queue_names` input in the env's `main.tf`, plan, apply. The DLQ alarm in `modules/observability` automatically picks up new DLQs through the `sqs_dlq_arns` input.
