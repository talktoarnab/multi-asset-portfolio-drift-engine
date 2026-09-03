data "aws_caller_identity" "current" {}

# Granted here rather than in the application stack: the pipeline identity must
# not be able to widen its own permissions, and IAM propagation delays make
# self-granting applies fail intermittently.
resource "aws_iam_policy" "deploy" {
  name        = "${var.resource_prefix}-terraform-deploy"
  description = "Permissions the GitHub Actions deploy user needs beyond its existing S3, Lambda, API Gateway, IAM, and CloudFront access"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ManageDriftEngineTable"
        Effect = "Allow"
        Action = [
          "dynamodb:CreateTable",
          "dynamodb:DeleteTable",
          "dynamodb:UpdateTable",
          "dynamodb:DescribeTable",
          # point_in_time_recovery and the TTL read on every refresh.
          "dynamodb:DescribeContinuousBackups",
          "dynamodb:UpdateContinuousBackups",
          "dynamodb:DescribeTimeToLive",
          "dynamodb:UpdateTimeToLive",
          "dynamodb:DescribeTableReplicaAutoScaling",
          # Required because the provider sets default_tags on every resource.
          "dynamodb:ListTagsOfResource",
          "dynamodb:TagResource",
          "dynamodb:UntagResource",
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.resource_prefix}-*"
      },
      {
        Sid    = "ManageDriftEngineSchedule"
        Effect = "Allow"
        Action = [
          "events:PutRule",
          "events:DeleteRule",
          "events:DescribeRule",
          "events:EnableRule",
          "events:DisableRule",
          "events:PutTargets",
          "events:RemoveTargets",
          "events:ListTargetsByRule",
          "events:ListTagsForResource",
          "events:TagResource",
          "events:UntagResource",
        ]
        Resource = "arn:aws:events:${var.aws_region}:${data.aws_caller_identity.current.account_id}:rule/${var.resource_prefix}-*"
      },
      {
        Sid    = "ReadWriteRemoteState"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = "${aws_s3_bucket.tfstate.arn}/*"
      },
      {
        Sid      = "ListStateBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.tfstate.arn
      },
      {
        # Neither action supports resource-level permissions.
        Sid    = "ListOperationsRequireWildcard"
        Effect = "Allow"
        Action = [
          "dynamodb:ListTables",
          "events:ListRules",
        ]
        Resource = "*"
      },
    ]
  })
}

resource "aws_iam_user_policy_attachment" "deploy" {
  user       = var.deploy_user_name
  policy_arn = aws_iam_policy.deploy.arn
}
