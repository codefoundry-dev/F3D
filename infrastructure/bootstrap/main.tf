data "aws_caller_identity" "current" {}

# KMS key encrypts Terraform state at rest. Used by the S3 bucket SSE config.
resource "aws_kms_key" "tfstate" {
  description             = "Encrypts Terraform state for the f3d infrastructure repo"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "forethread-tfstate-key"
  }
}

resource "aws_kms_alias" "tfstate" {
  name          = var.kms_key_alias
  target_key_id = aws_kms_key.tfstate.key_id
}

# S3 bucket for Terraform state. Versioned, encrypted, public access blocked.
resource "aws_s3_bucket" "tfstate" {
  bucket        = var.state_bucket_name
  force_destroy = false

  tags = {
    Name = var.state_bucket_name
  }
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.tfstate.arn
    }

    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id

  rule {
    id     = "expire-old-state-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# DynamoDB table for state locking — stops two `terraform apply`s racing.
resource "aws_dynamodb_table" "lock" {
  name         = var.lock_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name = var.lock_table_name
  }
}
