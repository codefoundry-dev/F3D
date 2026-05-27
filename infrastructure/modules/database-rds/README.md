# modules/database-rds

Single-AZ Postgres 16 on Graviton (`db.t4g.micro` by default). Mirrors the `postgres:16-alpine` image used in `docker-compose.production.yml` so the backend code does not need to change between local Docker and AWS.

## Key behavior

- Master password is RDS-managed via Secrets Manager (`manage_master_user_password = true`) — Terraform never sees it, rotation is RDS-handled.
- Slow-query (`>1s`) and connection logging are on by default.
- gp3 storage with autoscaling up to `max_allocated_storage`.
- Deletion protection on by default; a destroy still leaves a final snapshot.
- pgaudit is opt-in via `enable_pgaudit` (requires manual reboot + `CREATE EXTENSION pgaudit` afterwards).

## Inputs

| Name | Required | Default |
|---|---|---|
| `env` | yes | — |
| `vpc_id` | yes | — |
| `private_subnet_ids` (≥ 2) | yes | — |
| `allowed_security_group_ids` | yes | — |
| `backup_retention_days` | yes | — |
| `db_name` | no | `forethread` |
| `instance_class` | no | `db.t4g.micro` |
| `enable_pgaudit` | no | `false` |
| `deletion_protection` | no | `true` |

## Outputs

| Name | Description |
|---|---|
| `endpoint` | `host:port` for `DATABASE_URL` |
| `address` | DNS hostname (no port) |
| `port` | `5432` |
| `db_name` | Initial DB name |
| `master_secret_arn` | Secrets Manager ARN for the master user |
| `security_group_id` | RDS SG (for downstream ingress) |
| `instance_id` | Identifier (used as `DBInstanceIdentifier` dimension) |
