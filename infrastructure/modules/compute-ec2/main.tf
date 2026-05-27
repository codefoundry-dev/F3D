# Account/region context — used to template ECR registry URLs into user_data
# and to scope IAM policy ARNs (see iam.tf).
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  ssm_parameter_prefix = var.ssm_parameter_prefix != "" ? var.ssm_parameter_prefix : "/forethread/${var.env}"
}

############################################
# ECR repository - backend image registry
############################################

# Single repo per env. Tags are MUTABLE — `:latest` gets re-pushed every deploy
# and the EC2's docker-compose.yml uses `:latest` to pick up new images on
# `pull`. Per-release immutability is preserved by the `:sha-<short>` tag the
# deploy workflow also pushes (content-addressed, never overwritten).
resource "aws_ecr_repository" "this" {
  name                 = "forethread-${var.env}-backend"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-ecr"
  })
}

resource "aws_ecr_lifecycle_policy" "this" {
  repository = aws_ecr_repository.this.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the most recent 10 images, expire older."
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

############################################
# AMI lookup - Amazon Linux 2023 ARM64 (Graviton)
############################################

# t4g.* requires arm64 — pulling the wrong arch silently fails to boot.
data "aws_ami" "al2023_arm64" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

############################################
# Security group + rules
############################################

# EC2 SG. Rules attached separately via aws_security_group_rule so additional
# rules can be added without recreating the SG.
resource "aws_security_group" "this" {
  description = "forethread-${var.env}-backend-ec2 ingress for HTTP/HTTPS (Caddy auto-TLS) and unrestricted egress (RDS, ElastiCache, S3, ECR, Resend, etc)."
  name        = "forethread-${var.env}-backend-ec2-sg"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-ec2-sg"
  })
}

# 80 is open so Caddy can serve the HTTP-01 ACME challenge and 301-redirect.
resource "aws_security_group_rule" "ingress_http" {
  type              = "ingress"
  description       = "HTTP for Caddy ACME HTTP-01 challenge and HTTPS redirect."
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  security_group_id = aws_security_group.this.id
  cidr_blocks       = ["0.0.0.0/0"]
}

# 443 is the actual app entry point. Caddy terminates TLS here and
# reverse-proxies to localhost:${app_port}. The internal app port is never
# exposed.
resource "aws_security_group_rule" "ingress_https" {
  type              = "ingress"
  description       = "HTTPS for the public NestJS API (terminated by Caddy)."
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = aws_security_group.this.id
  cidr_blocks       = ["0.0.0.0/0"]
}

# Egress is wide open: the host needs to reach RDS, ElastiCache, S3, Secrets
# Manager, SSM, CloudWatch Logs, ECR, Resend, Google APIs, Gemini API, and
# Let's Encrypt for cert renewal.
resource "aws_security_group_rule" "egress_all" {
  type              = "egress"
  description       = "All egress (AWS APIs, third-party APIs, Lets Encrypt cert renewal)."
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  security_group_id = aws_security_group.this.id
  cidr_blocks       = ["0.0.0.0/0"]
}

############################################
# EC2 instance
############################################

# user_data renders Caddy + docker-compose + CloudWatch agent onto the box.
# The backend image is pulled from ECR by the first SSM-driven deploy after
# boot — intentionally NOT baked into the AMI.
locals {
  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    env                 = var.env
    region              = data.aws_region.current.name
    aws_account_id      = data.aws_caller_identity.current.account_id
    app_port            = var.app_port
    domain_name         = var.domain_name
    log_group_name      = var.log_group_name
    host_log_group_name = var.host_log_group_name
    ecr_repository_url  = aws_ecr_repository.this.repository_url
    ssm_prefix          = local.ssm_parameter_prefix
  })
}

resource "aws_instance" "this" {
  ami           = data.aws_ami.al2023_arm64.id
  instance_type = var.instance_type
  subnet_id     = var.public_subnet_id

  vpc_security_group_ids      = [aws_security_group.this.id]
  iam_instance_profile        = aws_iam_instance_profile.this.name
  associate_public_ip_address = true

  # IMDSv2 only. Single hop limit bumped to 2 so containers on the host
  # (Caddy/backend) can still reach IMDS through the Docker bridge.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = var.root_volume_type
    volume_size           = var.root_volume_size_gb
    encrypted             = true
    delete_on_termination = true
  }

  user_data                   = local.user_data
  user_data_replace_on_change = true

  # Don't replace the instance just because Amazon shipped a new AMI. AMI rolls
  # are a deliberate operation: bump the data source filter, taint, and apply.
  lifecycle {
    ignore_changes = [ami]
  }

  # Project=forethread is load-bearing: the deploy role's SSM SendCommand
  # statement gates on aws:ResourceTag/Project == "forethread".
  tags = merge(var.tags, {
    Name    = "forethread-${var.env}-backend-ec2"
    Project = "forethread"
  })
}

############################################
# Stable public IPv4 for DNS
############################################

resource "aws_eip" "this" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "forethread-${var.env}-backend-eip"
  })
}

resource "aws_eip_association" "this" {
  allocation_id = aws_eip.this.id
  instance_id   = aws_instance.this.id
}
