############################################
# GitHub OIDC identity provider (account-wide)
############################################

# One OIDC provider per AWS account. Both the Terraform role and the deploy
# role federate through this single provider.
#
# Note: AWS now validates the GitHub OIDC token by certificate chain rather
# than by thumbprint, but the field is still required by the API. We pin the
# AWS-recommended thumbprints documented by GitHub.
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]

  tags = merge(var.tags, {
    Name = "forethread-github-actions-oidc"
  })
}

############################################
# Subject claim helpers
############################################

locals {
  repo_qualified = "${var.github_org}/${var.repo_name}"

  # GitHub Actions sets the OIDC token `sub` claim differently depending on
  # whether the job uses an `environment:` block:
  #   - no environment   -> repo:OWNER/REPO:ref:refs/heads/<branch>  or  :pull_request
  #   - with environment -> repo:OWNER/REPO:environment:<env-name>

  # Allowed `sub` values for the Terraform role:
  #   - any PR (plan, no environment)
  #   - any branch in `terraform_branches` (push triggering apply)
  #   - any environment listed in `terraform_environments`
  terraform_subjects = concat(
    ["repo:${local.repo_qualified}:pull_request"],
    [for b in var.terraform_branches : "repo:${local.repo_qualified}:ref:refs/heads/${b}"],
    [for e in var.terraform_environments : "repo:${local.repo_qualified}:environment:${e}"],
  )

  # Allowed `sub` values for the deploy role:
  #   - any branch in `deploy_branches`
  #   - any PR (build + push image for review)
  #   - any environment listed in `deploy_environments`
  deploy_subjects = concat(
    [for b in var.deploy_branches : "repo:${local.repo_qualified}:ref:refs/heads/${b}"],
    ["repo:${local.repo_qualified}:pull_request"],
    [for e in var.deploy_environments : "repo:${local.repo_qualified}:environment:${e}"],
  )
}

############################################
# Terraform role (privileged) - infrastructure/ workflows
############################################

data "aws_iam_policy_document" "terraform_trust" {
  statement {
    sid     = "GitHubOIDCTrustTerraform"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.terraform_subjects
    }
  }
}

resource "aws_iam_role" "terraform" {
  name        = "forethread-github-actions-terraform-role"
  description = "Role assumed via OIDC by f3d GitHub Actions workflows to run terraform plan/apply."

  assume_role_policy   = data.aws_iam_policy_document.terraform_trust.json
  max_session_duration = 3600

  tags = merge(var.tags, {
    Name = "forethread-github-actions-terraform-role"
  })
}

# v1 attaches AdministratorAccess so bootstrap iteration can build arbitrary
# infra without churning this module on every new resource type. Tighten to a
# tdx-prefix-scoped policy after 2-3 successful applies confirm the resource
# set is stable.
resource "aws_iam_role_policy_attachment" "terraform_admin" {
  role       = aws_iam_role.terraform.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

############################################
# Deploy role - backend image push + SSM RunCommand
############################################

data "aws_iam_policy_document" "deploy_trust" {
  statement {
    sid     = "GitHubOIDCTrustDeploy"
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.deploy_subjects
    }
  }
}

resource "aws_iam_role" "deploy" {
  name        = "forethread-github-actions-deploy-role"
  description = "Role assumed via OIDC by f3d GitHub Actions workflows to push images to ECR and trigger deploys via SSM RunCommand."

  assume_role_policy   = data.aws_iam_policy_document.deploy_trust.json
  max_session_duration = 3600

  tags = merge(var.tags, {
    Name = "forethread-github-actions-deploy-role"
  })
}

data "aws_iam_policy_document" "deploy" {
  # ----- ECR auth (must be on '*' per AWS API) -----
  statement {
    sid       = "EcrGetAuthToken"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # ----- ECR push to forethread-* repos only -----
  statement {
    sid    = "EcrPushForethreadRepos"
    effect = "Allow"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:DescribeRepositories",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:ListImages",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = ["arn:aws:ecr:${var.aws_region}:*:repository/forethread-*"]
  }

  # ----- SSM SendCommand: split across two statements -----
  # aws:ResourceTag/Project condition is evaluated against EVERY resource in
  # a statement. The AWS-managed document has no Project tag, so combining it
  # with an EC2 instance in one statement fails. Two statements: one allows
  # the document unconditionally, one allows instance targeting gated by tag.

  statement {
    sid       = "SsmSendCommandUseRunShellScriptDoc"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ssm:${var.aws_region}::document/AWS-RunShellScript"]
  }

  statement {
    sid       = "SsmSendCommandToForethreadInstances"
    effect    = "Allow"
    actions   = ["ssm:SendCommand"]
    resources = ["arn:aws:ec2:${var.aws_region}:*:instance/*"]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/Project"
      values   = ["forethread"]
    }
  }

  # ----- SSM read-back of command results (no resource-level scope possible) -----
  statement {
    sid    = "SsmReadCommandResults"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:ListCommands",
    ]
    resources = ["*"]
  }

  # ----- EC2 read-only: needed by the deploy workflow's smoke test to look up
  # the target instance's public IP. ec2:DescribeInstances does not support
  # resource-level permissions or tag conditions.
  statement {
    sid       = "Ec2DescribeForSmokeTest"
    effect    = "Allow"
    actions   = ["ec2:DescribeInstances"]
    resources = ["*"]
  }

  # ----- SSM Parameter Store: read-only on /forethread/* -----
  statement {
    sid    = "SsmParameterReadForethread"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    resources = ["arn:aws:ssm:${var.aws_region}:*:parameter/forethread/*"]
  }
}

resource "aws_iam_policy" "deploy" {
  name        = "forethread-github-actions-deploy-policy"
  description = "ECR push to forethread-* repos, SSM RunCommand to Project=forethread instances, and read-only access to /forethread/* SSM parameters."
  policy      = data.aws_iam_policy_document.deploy.json

  tags = merge(var.tags, {
    Name = "forethread-github-actions-deploy-policy"
  })
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}
