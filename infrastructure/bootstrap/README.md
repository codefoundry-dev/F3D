# bootstrap/

One-time setup that creates the resources Terraform needs to store its own state for the rest of the
repo:

- KMS key (`alias/forethread-tfstate`) — encrypts state at rest
- S3 bucket (`forethread-tfstate-eu-north-1`) — versioned, KMS-encrypted, public access blocked
- DynamoDB table (`forethread-tfstate-lock`) — state locking

This directory uses **local state** (chicken-and-egg: you can't store the state-bucket-creating
state in the bucket it creates). Commit `.terraform.lock.hcl` here; **never commit
`terraform.tfstate`**.

## When to run

- First time setting the repo up (once per AWS account)
- If any of the three bootstrap resources need to change (very rare)

## How to run

```bash
# From a machine with AdministratorAccess (one-time setup needs broad perms)
cd infrastructure/bootstrap
terraform init
terraform plan
terraform apply
```

Confirm the plan creates exactly: 1 KMS key, 1 KMS alias, 1 S3 bucket + 4 bucket-config resources, 1
DynamoDB table.

## After bootstrap

1. Save the local `terraform.tfstate` somewhere safe (encrypted) — needed if you ever have to
   rebuild bootstrap. **Do not commit it.**
2. Initialize each env to use the new backend:
   ```bash
   cd ../envs/prod
   terraform init
   ```

## Don't

- Don't run `terraform destroy` here without first emptying every env's state and confirming.
  Destroying the bucket destroys all state.
- Don't change the bucket name after the first apply — it's referenced from every env's backend
  config.
