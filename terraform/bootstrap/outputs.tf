output "state_bucket_name" {
  description = "Bucket configured as the backend for both stacks"
  value       = aws_s3_bucket.tfstate.id
}

output "deploy_policy_arn" {
  description = "Policy attached to the GitHub Actions deploy user"
  value       = aws_iam_policy.deploy.arn
}
