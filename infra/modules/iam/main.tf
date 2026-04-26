data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name}-lambda"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = var.tags
}

# Just this table, and only the five actions the repo uses.
data "aws_iam_policy_document" "table" {
  statement {
    sid = "ItemsTable"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
      "dynamodb:DeleteItem",
      "dynamodb:UpdateItem",
    ]
    resources = [var.table_arn]
  }
}

resource "aws_iam_role_policy" "table" {
  name   = "items-table"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.table.json
}

# Logs go to the function's own log group only, no CreateLogGroup.
data "aws_iam_policy_document" "logs" {
  statement {
    sid       = "OwnLogGroup"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${var.log_group_arn}:*"]
  }
}

resource "aws_iam_role_policy" "logs" {
  name   = "own-log-group"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.logs.json
}
