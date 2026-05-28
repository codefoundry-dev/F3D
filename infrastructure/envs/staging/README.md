# envs/staging

Staging environment composition. Same modules as prod with smaller defaults:

| Knob                     | Staging                    | Prod                 |
| ------------------------ | -------------------------- | -------------------- |
| VPC CIDR                 | `10.10.0.0/16`             | `10.0.0.0/16`        |
| EC2 instance type        | `t4g.micro`                | `t4g.small`          |
| RDS instance class       | `db.t4g.micro`             | `db.t4g.micro`       |
| RDS backup retention     | 7 days                     | 30 days              |
| Redis snapshot retention | 0 days (off)               | 1 day                |
| Domain                   | `api-stage.forethread.com` | `api.forethread.com` |

## Apply order

Same as prod — `bootstrap/` and `_global/` first, then this stack.

```bash
cd infrastructure/envs/staging
terraform init
terraform plan  -var "notification_email=alerts@example.com"
terraform apply -var "notification_email=alerts@example.com"
```

## After the first apply

1. Confirm the SNS subscription email.
2. Populate the secret slots (same set as prod, populated independently).
3. Point `api-stage.forethread.com` at `ec2_public_ip`.
4. Push the first backend image to ECR and trigger the deploy.
