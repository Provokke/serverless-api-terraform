variable "name" {
  description = "DynamoDB table name."
  type        = string
}

variable "tags" {
  description = "Tags applied to the table."
  type        = map(string)
  default     = {}
}
