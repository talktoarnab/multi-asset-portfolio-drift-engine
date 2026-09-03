terraform {
  required_version = ">= 1.10.0"

  # Stored alongside the main stack's state but under a separate key, so the
  # two configurations never contend for the same lock.
  backend "s3" {
    bucket       = "portfolio-drift-engine-tfstate-523115032266"
    key          = "bootstrap/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "multi-asset-portfolio-drift-engine"
      ManagedBy = "Terraform"
      Component = "bootstrap"
    }
  }
}
