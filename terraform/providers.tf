terraform {
  # 1.10+ required for S3 native state locking (use_lockfile).
  required_version = ">= 1.10.0"

  # Remote state so CI runs share one source of truth. Backend blocks cannot
  # reference variables, so these values are literal.
  backend "s3" {
    bucket       = "portfolio-drift-engine-tfstate-523115032266"
    key          = "dev/terraform.tfstate"
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
      Environment = var.environment
      Project     = "multi-asset-portfolio-drift-engine"
      ManagedBy   = "Terraform"
    }
  }
}
