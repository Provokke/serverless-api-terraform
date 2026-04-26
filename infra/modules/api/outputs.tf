output "api_url" {
  description = "Invoke URL of the HTTP API."
  value       = aws_apigatewayv2_stage.default.invoke_url
}

output "log_group_arn" {
  description = "ARN of the function's log group."
  value       = aws_cloudwatch_log_group.lambda.arn
}
