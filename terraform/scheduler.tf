# EventBridge Rule: Trigger daily at 12:00 AM UTC
resource "aws_cloudwatch_event_rule" "daily_evaluator" {
  name                = "portfolio-drift-engine-daily-eval-${var.environment}"
  description         = "Triggers the daily portfolio drift evaluator Lambda function"
  schedule_expression = "cron(0 0 * * ? *)" # Run daily at midnight UTC
}

# EventBridge Target: Link Rule to Lambda
resource "aws_cloudwatch_event_target" "daily_evaluator" {
  rule      = aws_cloudwatch_event_rule.daily_evaluator.name
  target_id = "portfolio-drift-engine-evaluator"
  arn       = aws_lambda_function.daily_evaluator.arn
}

# Lambda Permission: Allow EventBridge to invoke the daily evaluator Lambda
resource "aws_lambda_permission" "eventbridge_evaluator" {
  statement_id  = "AllowEventBridgeInvokeEvaluator"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.daily_evaluator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_evaluator.arn
}
