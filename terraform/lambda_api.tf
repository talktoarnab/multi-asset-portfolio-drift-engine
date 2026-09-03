# Archive the backend code
data "archive_file" "backend_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend.zip"
  excludes    = ["venv", "__pycache__", "common/__pycache__", "api/__pycache__", "cron/__pycache__"]
}

# IAM Role for Lambda Execution
resource "aws_iam_role" "lambda_exec" {
  name = "portfolio-drift-engine-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policy for DynamoDB, SES, and CloudWatch Logs
resource "aws_iam_policy" "lambda_policy" {
  name        = "portfolio-drift-engine-lambda-policy-${var.environment}"
  description = "IAM policy for Lambda to access DynamoDB, SES, and CloudWatch Logs"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.portfolio_drift_engine.arn,
          "${aws_dynamodb_table.portfolio_drift_engine.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Attach Policy to Role
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# Common environment variables for all Lambda functions
locals {
  lambda_env = {
    DYNAMODB_TABLE = aws_dynamodb_table.portfolio_drift_engine.name
    JWT_SECRET     = var.jwt_secret
    SENDER_EMAIL   = var.sender_email
    MOCK_DB        = "false"
  }
}

# Lambda Function: Auth Handler
resource "aws_lambda_function" "auth_handler" {
  filename         = data.archive_file.backend_zip.output_path
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  function_name    = "portfolio-drift-engine-auth-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "api.auth_handler.handler"
  runtime          = "python3.10"
  timeout          = 15
  memory_size      = 256

  environment {
    variables = local.lambda_env
  }
}

# Lambda Function: Portfolio Handler
resource "aws_lambda_function" "portfolio_handler" {
  filename         = data.archive_file.backend_zip.output_path
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  function_name    = "portfolio-drift-engine-portfolio-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "api.portfolio_handler.handler"
  runtime          = "python3.10"
  timeout          = 15
  memory_size      = 256

  environment {
    variables = local.lambda_env
  }
}

# Lambda Function: Rebalance Handler
resource "aws_lambda_function" "rebalance_handler" {
  filename         = data.archive_file.backend_zip.output_path
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  function_name    = "portfolio-drift-engine-rebalance-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "api.rebalance_handler.handler"
  runtime          = "python3.10"
  timeout          = 15
  memory_size      = 256

  environment {
    variables = local.lambda_env
  }
}

# Lambda Function: Daily Evaluator (Cron)
resource "aws_lambda_function" "daily_evaluator" {
  filename         = data.archive_file.backend_zip.output_path
  source_code_hash = data.archive_file.backend_zip.output_base64sha256
  function_name    = "portfolio-drift-engine-evaluator-${var.environment}"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "cron.daily_evaluator.lambda_handler"
  runtime          = "python3.10"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = local.lambda_env
  }
}

# --- API Gateway REST API ---
resource "aws_api_gateway_rest_api" "api" {
  name        = "portfolio-drift-engine-api-${var.environment}"
  description = "REST API for Multi-Asset Portfolio Drift Engine"
}

# Proxy Resource for Auth Lambda
resource "aws_api_gateway_resource" "auth" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "auth"
}

resource "aws_api_gateway_resource" "auth_proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.auth.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "auth_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.auth_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "auth_proxy" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.auth_proxy.id
  http_method             = aws_api_gateway_method.auth_proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.auth_handler.invoke_arn
}

# Proxy Resource for Portfolios Lambda
resource "aws_api_gateway_resource" "portfolios" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "portfolios"
}

resource "aws_api_gateway_method" "portfolios" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.portfolios.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "portfolios" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.portfolios.id
  http_method             = aws_api_gateway_method.portfolios.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.portfolio_handler.invoke_arn
}

resource "aws_api_gateway_resource" "portfolio_proxy" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.portfolios.id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "portfolio_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.portfolio_proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "portfolio_proxy" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.portfolio_proxy.id
  http_method             = aws_api_gateway_method.portfolio_proxy.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.portfolio_handler.invoke_arn
}

# Rebalance route (redirected to rebalance_handler)
# We can handle this in the portfolio_handler or route it specifically.
# Let's route /portfolios/{id}/rebalance to the rebalance_handler.
# This requires a specific path.
# Since we already have a generic {proxy+} on /portfolios, API Gateway might conflict if we define a specific sub-resource.
# To keep it simple and robust, we can just let the portfolio_handler handle rebalancing, or we can route it in API Gateway.
# Actually, letting portfolio_handler invoke rebalance_handler or routing it directly is great.
# Let's route /portfolios/{portfolio_id}/rebalance to the rebalance_handler.
# In API Gateway, a more specific path takes precedence over a wildcard proxy.
resource "aws_api_gateway_resource" "portfolio_id" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.portfolios.id
  path_part   = "{portfolio_id}"
}

resource "aws_api_gateway_resource" "rebalance" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.portfolio_id.id
  path_part   = "rebalance"
}

resource "aws_api_gateway_method" "rebalance" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.rebalance.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "rebalance" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.rebalance.id
  http_method             = aws_api_gateway_method.rebalance.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.rebalance_handler.invoke_arn
}

# --- Lambda permissions for API Gateway ---
resource "aws_lambda_permission" "api_auth" {
  statement_id  = "AllowAPIGatewayInvokeAuth"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*/*"
}

resource "aws_lambda_permission" "api_portfolio" {
  statement_id  = "AllowAPIGatewayInvokePortfolio"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.portfolio_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*/*"
}

resource "aws_lambda_permission" "api_rebalance" {
  statement_id  = "AllowAPIGatewayInvokeRebalance"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.rebalance_handler.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*/*"
}

# --- Deploy API Gateway ---
resource "aws_api_gateway_deployment" "api" {
  depends_on = [
    aws_api_gateway_integration.auth_proxy,
    aws_api_gateway_integration.portfolios,
    aws_api_gateway_integration.portfolio_proxy,
    aws_api_gateway_integration.rebalance
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "api" {
  deployment_id = aws_api_gateway_deployment.api.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}
