variable "aws_region" {
  type        = string
  description = "Region holding the Terraform state bucket and the application stack"
  default     = "us-east-1"
}

variable "state_bucket_name" {
  type        = string
  description = "Bucket holding remote state for both the bootstrap and application stacks"
  default     = "portfolio-drift-engine-tfstate-523115032266"
}

variable "deploy_user_name" {
  type        = string
  description = "IAM user whose access keys are stored as GitHub Actions secrets"
  default     = "lamba-cli-access"
}

variable "resource_prefix" {
  type        = string
  description = "Name prefix shared by every resource the application stack manages"
  default     = "portfolio-drift-engine"
}
