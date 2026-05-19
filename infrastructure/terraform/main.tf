# ─────────────────────────────────────────────────────────────
# Terraform — Asset Inventory Infrastructure (Production)
# Resources: VPC, ECS Fargate, RDS PostgreSQL, S3, CloudFront
# ─────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.8.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }

  # Remote state — replace bucket/key per environment
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "asset-inventory/prod/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "AssetInventory"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ─── Variables ────────────────────────────────────────────────
variable "aws_region"        { default = "ap-south-1" }
variable "environment"       { default = "production" }
variable "app_name"          { default = "asset-inventory" }
variable "db_password"       { sensitive = true }
variable "secret_key"        { sensitive = true }
variable "backend_image_uri" { description = "ECR URI for backend image" }

# ─── VPC ─────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  name        = "${var.app_name}-${var.environment}"
  environment = var.environment
  aws_region  = var.aws_region
}

# ─── RDS PostgreSQL ──────────────────────────────────────────
module "rds" {
  source = "./modules/rds"

  name              = "${var.app_name}-${var.environment}"
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_name           = "asset_inventory"
  db_username       = "asset_user"
  db_password       = var.db_password
  environment       = var.environment
}

# ─── S3 Buckets ───────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  app_name    = var.app_name
  environment = var.environment
}

# ─── ECS Fargate ─────────────────────────────────────────────
module "ecs" {
  source = "./modules/ecs"

  app_name           = var.app_name
  environment        = var.environment
  aws_region         = var.aws_region
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  backend_image_uri  = var.backend_image_uri
  db_url             = module.rds.connection_url
  secret_key         = var.secret_key
  s3_bucket_docs     = module.s3.documents_bucket_name
}

# ─── Outputs ─────────────────────────────────────────────────
output "alb_dns_name"         { value = module.ecs.alb_dns_name }
output "rds_endpoint"         { value = module.rds.endpoint }
output "frontend_bucket_name" { value = module.s3.frontend_bucket_name }
output "documents_bucket_name"{ value = module.s3.documents_bucket_name }
