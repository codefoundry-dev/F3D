# modules/network

VPC + public/private subnets across two AZs + Internet Gateway. **No NAT Gateway** — private workloads (RDS, ElastiCache) do not need outbound internet at v1.

## Inputs

| Name | Description | Required |
|---|---|---|
| `env` | `prod` or `staging` | yes |
| `cidr` | VPC CIDR (default `10.0.0.0/16`) | no |
| `availability_zones` | Two AZs to spread subnets across | no |
| `tags` | Standard tag bundle | no |

## Outputs

| Name | Description |
|---|---|
| `vpc_id` | VPC ID |
| `public_subnet_ids` | `[az-a, az-b]` |
| `private_subnet_ids` | `[az-a, az-b]` — no internet route |
| `availability_zones` | Same as input, surfaced for downstream wiring |
