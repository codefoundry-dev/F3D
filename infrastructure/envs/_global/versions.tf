terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  backend "s3" {
    bucket         = "forethread-tfstate-eu-north-1"
    key            = "envs/_global/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "forethread-tfstate-lock"
    encrypt        = true
    kms_key_id     = "alias/forethread-tfstate"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project    = "forethread"
      ManagedBy  = "terraform"
      Repository = "f3d"
      Scope      = "account-global"
    }
  }
}
