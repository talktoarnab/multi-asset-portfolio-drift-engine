// Empty rather than null while CloudFront is disabled, so `output -raw` keeps
// working in the deploy workflow.
output "frontend_url" {
  value       = var.enable_cloudfront ? "https://${aws_cloudfront_distribution.frontend[0].domain_name}" : ""
  description = "The URL of the CloudFront distribution serving the React frontend, empty when CloudFront is disabled"
}

output "api_url" {
  value       = aws_api_gateway_stage.api.invoke_url
  description = "The invoke URL of the API Gateway stage"
}

output "dynamodb_table_name" {
  value       = aws_dynamodb_table.portfolio_drift_engine.name
  description = "The name of the DynamoDB table"
}

output "s3_bucket_name" {
  value       = aws_s3_bucket.frontend.id
  description = "The name of the S3 bucket hosting the frontend static assets"
}

output "cloudfront_distribution_id" {
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.frontend[0].id : ""
  description = "The ID of the CloudFront distribution, empty when CloudFront is disabled"
}

