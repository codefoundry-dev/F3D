# modules/cache-redis

Single-node ElastiCache Redis. Replaces the `redis:7-alpine` container from
`docker-compose.production.yml`. No replicas, no cluster mode at v1 — the backend uses a single
`REDIS_URL` and does not need HA today.

## Key behavior

- Engine 7.1, family `redis7`, port 6379.
- Lives entirely in private subnets — no public access.
- One ingress rule per `allowed_security_group_ids` entry (EC2 SG passed by the caller).
- `snapshot_retention_limit` defaults to 0 (no backups); set to 1+ for prod if Redis state must
  survive a node replacement.

## Outputs

| Name                       | Description                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| `primary_endpoint_address` | DNS hostname of the cache node                                        |
| `port`                     | `6379`                                                                |
| `redis_url`                | `redis://<host>:<port>` — ready for the backend's `REDIS_URL` env var |
| `security_group_id`        | Redis SG (for downstream wiring)                                      |

## Cost

`cache.t4g.micro` ≈ $11–13/month on-demand. Multi-AZ would more than double it.
