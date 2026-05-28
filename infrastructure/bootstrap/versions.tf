terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project    = "forethread"
      ManagedBy  = "terraform"
      Repository = "f3d"
      Component  = "bootstrap"
    }
  }
}
