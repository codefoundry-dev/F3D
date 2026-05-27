############################################
# Trust policy - EC2 service may assume the role
############################################

data "aws_iam_policy_document" "ec2_trust" {
  statement {
    sid     = "Ec2InstanceAssume"
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "this" {
  name        = "forethread-${var.env}-backend-ec2-role"
  description = "Instance role for forethread-${var.env}-backend-ec2. Grants SSM Agent, ECR pull, Secrets Manager / KMS for app config, SQS, S3 uploads, CloudWatch Logs, and SSM Parameter Store reads under the env prefix."

  assume_role_policy   = data.aws_iam_policy_document.ec2_trust.json
  max_session_duration = 3600

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-ec2-role"
  })
}

############################################
# AWS-managed: SSM Agent core permissions
############################################

resource "aws_iam_role_policy_attachment" "ssm_managed_core" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

############################################
# Custom runtime policy
############################################

locals {
  # Always include the RDS master secret; merge with caller-supplied secrets.
  effective_secret_arns = toset(concat(var.secret_arns_to_read, [var.rds_master_secret_arn]))

  log_group_arn_patterns = [
    "arn:aws:logs:*:*:log-group:${var.log_group_name}:*",
    "arn:aws:logs:*:*:log-group:${var.host_log_group_name}:*",
  ]

  ssm_parameter_arn_pattern = "arn:aws:ssm:*:*:parameter${local.ssm_parameter_prefix}/*"

  # Expand each bucket ARN into the bucket itself + all its objects.
  s3_bucket_object_arns = [for arn in var.s3_bucket_arns : "${arn}/*"]
}

data "aws_iam_policy_document" "runtime" {
  # ----- ECR auth (must be on '*' per AWS API) -----
  statement {
    sid       = "EcrGetAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # ----- ECR pull, scoped to this env's repository only -----
  statement {
    sid    = "EcrPullBackendImage"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [aws_ecr_repository.this.arn]
  }

  # ----- Secrets Manager: explicit allow-list incl. RDS master secret -----
  dynamic "statement" {
    for_each = length(local.effective_secret_arns) > 0 ? [1] : []

    content {
      sid       = "SecretsManagerReadAppSecrets"
      effect    = "Allow"
      actions   = ["secretsmanager:GetSecretValue"]
      resources = tolist(local.effective_secret_arns)
    }
  }

  # ----- KMS decrypt for customer-managed keys backing the secrets above.
  dynamic "statement" {
    for_each = length(var.kms_key_arns_to_decrypt) > 0 ? [1] : []

    content {
      sid       = "KmsDecryptSecretsCmks"
      effect    = "Allow"
      actions   = ["kms:Decrypt"]
      resources = var.kms_key_arns_to_decrypt
    }
  }

  # ----- SQS: send/receive on caller-provided main queues only.
  dynamic "statement" {
    for_each = length(var.sqs_queue_arns) > 0 ? [1] : []

    content {
      sid    = "SqsBackendQueues"
      effect = "Allow"
      actions = [
        "sqs:ChangeMessageVisibility",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
        "sqs:GetQueueUrl",
        "sqs:ReceiveMessage",
        "sqs:SendMessage",
      ]
      resources = var.sqs_queue_arns
    }
  }

  # ----- S3: read/write on the uploads bucket(s).
  # Bucket-level actions (ListBucket, GetBucketLocation) on the bucket ARNs;
  # object-level actions (Get/Put/Delete) on <arn>/*.
  dynamic "statement" {
    for_each = length(var.s3_bucket_arns) > 0 ? [1] : []

    content {
      sid    = "S3BucketLevelActions"
      effect = "Allow"
      actions = [
        "s3:GetBucketLocation",
        "s3:ListBucket",
        "s3:ListBucketMultipartUploads",
      ]
      resources = var.s3_bucket_arns
    }
  }

  dynamic "statement" {
    for_each = length(local.s3_bucket_object_arns) > 0 ? [1] : []

    content {
      sid    = "S3ObjectLevelActions"
      effect = "Allow"
      actions = [
        "s3:AbortMultipartUpload",
        "s3:DeleteObject",
        "s3:GetObject",
        "s3:GetObjectAttributes",
        "s3:ListMultipartUploadParts",
        "s3:PutObject",
      ]
      resources = local.s3_bucket_object_arns
    }
  }

  # ----- CloudWatch Logs: write streams under the env's log groups.
  statement {
    sid    = "CloudWatchLogsWrite"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
    ]
    resources = local.log_group_arn_patterns
  }

  # ----- SSM Parameter Store: read-only under the env's prefix.
  statement {
    sid    = "SsmParameterReadEnvPrefix"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    resources = [local.ssm_parameter_arn_pattern]
  }
}

resource "aws_iam_policy" "runtime" {
  name        = "forethread-${var.env}-backend-ec2-runtime-policy"
  description = "Runtime permissions for forethread-${var.env}-backend-ec2: ECR pull, Secrets Manager / KMS for app config, SQS, S3 uploads, CloudWatch Logs, and SSM Parameter Store reads under the env prefix."
  policy      = data.aws_iam_policy_document.runtime.json

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-ec2-runtime-policy"
  })
}

resource "aws_iam_role_policy_attachment" "runtime" {
  role       = aws_iam_role.this.name
  policy_arn = aws_iam_policy.runtime.arn
}

############################################
# Instance profile - wraps the role for EC2
############################################

resource "aws_iam_instance_profile" "this" {
  name = "forethread-${var.env}-backend-ec2-profile"
  role = aws_iam_role.this.name

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-ec2-profile"
  })
}
