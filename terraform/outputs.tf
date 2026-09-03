output "frontend_url" {
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
  description = "The URL of the CloudFront distribution serving the React frontend"
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
  value       = aws_cloudfront_distribution.frontend.id
  description = "The ID of the CloudFront distribution"
}

