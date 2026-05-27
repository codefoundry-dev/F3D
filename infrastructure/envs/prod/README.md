# envs/prod

Production environment composition. Wires the modules into a single Terraform stack.

## What this stack creates

| Layer               | Resources                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Network             | VPC `10.0.0.0/16`, 2 public + 2 private subnets across `eu-north-1a/b`, IGW, route tables. No NAT.                                                        |
| Database            | RDS Postgres 16 (`db.t4g.micro`, single-AZ), 30-day backups, master credentials in Secrets Manager.                                                       |
| Cache               | ElastiCache Redis 7.1 (`cache.t4g.micro`, single-node), 1-day snapshots.                                                                                  |
| Storage             | S3 uploads bucket (`forethread-prod-uploads`), versioned, AES256, CORS for `web_app_origin`.                                                              |
| Secrets             | KMS key + Secrets Manager slots for `jwt-access-secret`, `jwt-refresh-secret`, `resend-api-key`, `gemini-api-key`, `google-places-api-key`, `sentry-dsn`. |
| Queues              | None by default. Populate `queue_names` when workers come online.                                                                                         |
| Compute             | EC2 `t4g.small` (Graviton, AL2023 ARM64) + IAM instance profile + ECR repo + Caddy/Compose user_data.                                                     |
| Observability       | CloudWatch log groups (30-day retention), SNS alerts topic, alarms for EC2 / RDS / Redis / DLQs / error rate.                                             |
| Cross-repo contract | All ARNs published to `/forethread/prod/*` in SSM Parameter Store.                                                                                        |

## Apply order

The bootstrap state bucket and the `_global` OIDC roles must already exist:

```bash
# Once per account, in this order:
cd ../../bootstrap && terraform init && terraform apply
cd ../envs/_global && terraform init && terraform apply
cd ../envs/prod
terraform init
terraform plan  -var "notification_email=alerts@example.com"
terraform apply -var "notification_email=alerts@example.com"
```

## After the first apply

1. **Confirm the SNS email subscription** — AWS sent a confirmation link to `notification_email`.
   The alarms will not deliver until you click it.
2. **Populate the Secrets Manager slots** — they are empty by design:
   ```bash
   for s in jwt-access-secret jwt-refresh-secret resend-api-key gemini-api-key google-places-api-key sentry-dsn; do
     aws secretsmanager put-secret-value --secret-id "/forethread-backend/prod/$s" --secret-string "..."
   done
   ```
3. **Point `api.forethread.com`** at `ec2_public_ip` (Elastic IP — stable across instance rebuilds).
   Caddy obtains a real Let's Encrypt cert on first start.
4. **Run the first deploy** — push the backend image to ECR (`forethread-prod-backend:latest`) and
   trigger an SSM SendCommand that pulls the image and brings the container up.
