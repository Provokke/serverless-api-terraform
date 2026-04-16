terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

variable "region" {
  description = "AWS region."
  type        = string
  default     = "eu-west-2"
}

variable "name" {
  description = "Resource name prefix."
  type        = string
  default     = "items-api-dev"
}

provider "aws" {
  region = var.region
}

locals {
  tags = {
    project = "serverless-api-terraform"
    env     = "dev"
  }
}

module "table" {
  source = "../../modules/table"
  name   = var.name
  tags   = local.tags
}

module "iam" {
  source        = "../../modules/iam"
  name          = var.name
  table_arn     = module.table.table_arn
  log_group_arn = module.api.log_group_arn
  tags          = local.tags
}

module "api" {
  source     = "../../modules/api"
  name       = var.name
  role_arn   = module.iam.role_arn
  table_name = module.table.table_name
  source_dir = "${path.root}/../../../dist"
  tags       = local.tags
}

output "api_url" {
  description = "Invoke URL of the HTTP API."
  value       = module.api.api_url
}

output "table_name" {
  description = "Name of the items table."
  value       = module.table.table_name
}
