variable "name" {
  description = "Prefix for the role name."
  type        = string
}

variable "table_arn" {
  description = "ARN of the one DynamoDB table the function may access."
  type        = string
}

variable "log_group_arn" {
  description = "ARN of the function's CloudWatch log group."
  type        = string
}

variable "tags" {
  description = "Tags applied to the role."
  type        = map(string)
  default     = {}
}
