# KMS key dedicated to encrypting this env's app secrets in Secrets Manager.
# Kept separate from the RDS master-user secret key (managed inside database-rds)
# so blast radius and rotation policy stay scoped to app secrets only.
resource "aws_kms_key" "this" {
  description             = "Encrypts /forethread-backend/${var.env}/* secrets in Secrets Manager."
  deletion_window_in_days = var.kms_deletion_window_days
  enable_key_rotation     = true

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-secrets-kms"
  })
}

resource "aws_kms_alias" "this" {
  name          = "alias/forethread-${var.env}-backend-secrets"
  target_key_id = aws_kms_key.this.key_id
}

# One Secrets Manager "slot" per requested name. Terraform owns the slot and
# its metadata (KMS key, recovery window, tags); the secret VALUE is set
# out-of-band — see README "Setting secret values". Intentionally no
# aws_secretsmanager_secret_version here: keeps plaintext out of state and
# forces a deliberate human step for sensitive values.
resource "aws_secretsmanager_secret" "this" {
  for_each = var.secret_names

  kms_key_id              = aws_kms_key.this.arn
  name                    = "/forethread-backend/${var.env}/${each.value}"
  recovery_window_in_days = var.recovery_window_days

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-secret-${each.value}"
  })
}
