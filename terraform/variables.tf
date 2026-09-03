variable "aws_region" {
  type        = string
  description = "The AWS region to deploy resources into"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (e.g., dev, staging, prod)"
  default     = "dev"
}

variable "jwt_secret" {
  type        = string
  description = "Secret key used for signing and verifying JWT tokens"
  sensitive   = true
  default     = "super-secret-drift-engine-key-2026-prod"
}

variable "enable_cloudfront" {
  type        = bool
  description = "Set true once the AWS account is verified for CloudFront. While false the frontend bucket has no CDN and no bucket policy, so only the API is reachable."
  default     = false
}

variable "sender_email" {
  type        = string
  description = "The verified SES email address to send drift alerts from"
  default     = "alerts@portfolio-drift-engine.com"
}
