# Chasm Telemetry Server - Terraform Configuration
# Deploys: API Gateway + Lambda + S3 + DynamoDB (optional)

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Uncomment to use S3 backend for state
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "chasm-telemetry/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "chasm-telemetry"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# =============================================================================
# VARIABLES
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "chasm-telemetry"
}

variable "retention_days" {
  description = "Number of days to retain telemetry data"
  type        = number
  default     = 90
}

variable "enable_dynamodb" {
  description = "Enable DynamoDB for real-time queries (additional cost)"
  type        = bool
  default     = false
}

variable "allowed_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

# =============================================================================
# RANDOM SUFFIX FOR UNIQUE NAMING
# =============================================================================

resource "random_id" "suffix" {
  byte_length = 4
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  name_suffix = random_id.suffix.hex
}

# =============================================================================
# S3 BUCKET FOR TELEMETRY STORAGE
# =============================================================================

resource "aws_s3_bucket" "telemetry" {
  bucket = "${local.name_prefix}-data-${local.name_suffix}"

  tags = {
    Name = "${local.name_prefix}-telemetry-bucket"
  }
}

resource "aws_s3_bucket_versioning" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id

  rule {
    id     = "expire-old-data"
    status = "Enabled"

    expiration {
      days = var.retention_days
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# =============================================================================
# DYNAMODB TABLE (OPTIONAL - FOR REAL-TIME QUERIES)
# =============================================================================

resource "aws_dynamodb_table" "telemetry" {
  count = var.enable_dynamodb ? 1 : 0

  name         = "${local.name_prefix}-records"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "installation_id"
  range_key    = "timestamp_id"

  attribute {
    name = "installation_id"
    type = "S"
  }

  attribute {
    name = "timestamp_id"
    type = "S"
  }

  attribute {
    name = "category"
    type = "S"
  }

  global_secondary_index {
    name            = "category-index"
    hash_key        = "category"
    range_key       = "timestamp_id"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name = "${local.name_prefix}-dynamodb"
  }
}

# =============================================================================
# API KEY FOR AUTHENTICATION
# =============================================================================

resource "random_password" "api_key" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "api_key" {
  name                    = "${local.name_prefix}-api-key-${local.name_suffix}"
  recovery_window_in_days = 0

  tags = {
    Name = "${local.name_prefix}-api-key"
  }
}

resource "aws_secretsmanager_secret_version" "api_key" {
  secret_id     = aws_secretsmanager_secret.api_key.id
  secret_string = random_password.api_key.result
}

# =============================================================================
# IAM ROLE FOR LAMBDA
# =============================================================================

resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.telemetry.arn,
          "${aws_s3_bucket.telemetry.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.api_key.arn
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:Query"
        ]
        Resource = var.enable_dynamodb ? [
          aws_dynamodb_table.telemetry[0].arn,
          "${aws_dynamodb_table.telemetry[0].arn}/index/*"
        ] : []
      }
    ]
  })
}

# =============================================================================
# LAMBDA FUNCTION
# =============================================================================

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/lambda.zip"
}

resource "aws_lambda_function" "ingest" {
  filename         = data.archive_file.lambda.output_path
  function_name    = "${local.name_prefix}-ingest"
  role             = aws_iam_role.lambda.arn
  handler          = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      S3_BUCKET         = aws_s3_bucket.telemetry.id
      API_KEY_SECRET_ID = aws_secretsmanager_secret.api_key.id
      DYNAMODB_TABLE    = var.enable_dynamodb ? aws_dynamodb_table.telemetry[0].name : ""
      ENVIRONMENT       = var.environment
    }
  }

  tags = {
    Name = "${local.name_prefix}-lambda"
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${aws_lambda_function.ingest.function_name}"
  retention_in_days = 14
}

# =============================================================================
# API GATEWAY (HTTP API - cheaper than REST API)
# =============================================================================

resource "aws_apigatewayv2_api" "telemetry" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.allowed_origins
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = ["Content-Type", "X-Api-Key", "Authorization"]
    max_age       = 3600
  }

  tags = {
    Name = "${local.name_prefix}-api"
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.telemetry.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId      = "$context.requestId"
      ip             = "$context.identity.sourceIp"
      requestTime    = "$context.requestTime"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      errorMessage   = "$context.error.message"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 14
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.telemetry.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.ingest.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "ingest" {
  api_id    = aws_apigatewayv2_api.telemetry.id
  route_key = "POST /ingest"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_apigatewayv2_route" "health" {
  api_id    = aws_apigatewayv2_api.telemetry.id
  route_key = "GET /health"
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.telemetry.execution_arn}/*/*"
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = aws_apigatewayv2_api.telemetry.api_endpoint
}

output "api_key" {
  description = "API key for authentication"
  value       = random_password.api_key.result
  sensitive   = true
}

output "s3_bucket" {
  description = "S3 bucket name for telemetry data"
  value       = aws_s3_bucket.telemetry.id
}

output "dynamodb_table" {
  description = "DynamoDB table name (if enabled)"
  value       = var.enable_dynamodb ? aws_dynamodb_table.telemetry[0].name : "disabled"
}

output "lambda_function" {
  description = "Lambda function name"
  value       = aws_lambda_function.ingest.function_name
}

output "chasm_config_commands" {
  description = "Commands to configure chasm CLI"
  value       = <<-EOT
    Run these commands to configure chasm:
    
    chasm telemetry config --endpoint ${aws_apigatewayv2_api.telemetry.api_endpoint}
    chasm telemetry config --api-key $(terraform output -raw api_key)
  EOT
}
