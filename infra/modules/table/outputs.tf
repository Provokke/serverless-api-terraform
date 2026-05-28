output "table_name" {
  description = "Name of the items table."
  value       = aws_dynamodb_table.this.name
}

output "table_arn" {
  description = "ARN of the items table."
  value       = aws_dynamodb_table.this.arn
}
