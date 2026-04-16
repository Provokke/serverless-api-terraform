# Remote state in S3 with a DynamoDB lock table, both created by hand beforehand.
# These are placeholders, swap in your own bucket and table before a real `terraform init`.
# CI uses `terraform init -backend=false` so none of this gets touched there.
terraform {
  backend "s3" {
    bucket         = "example-terraform-state-dev"
    key            = "serverless-api-terraform/dev.tfstate"
    region         = "eu-west-2"
    dynamodb_table = "example-terraform-locks"
    encrypt        = true
  }
}
