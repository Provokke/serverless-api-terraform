variable "name" {
  description = "Name used for the function, log group and API."
  type        = string
}

variable "role_arn" {
  description = "Lambda execution role ARN (from the iam module)."
  type        = string
}

variable "table_name" {
  description = "DynamoDB table the function reads and writes."
  type        = string
}

variable "source_dir" {
  description = "Directory holding the built handler (npm run build output copied here)."
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 14
}

variable "tags" {
  description = "Tags applied to resources."
  type        = map(string)
  default     = {}
}
