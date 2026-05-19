# ─────────────────────────────────────────────────────────────
# RDS PostgreSQL Module — Multi-AZ in private subnets
# ─────────────────────────────────────────────────────────────

variable "name"               {}
variable "vpc_id"             {}
variable "private_subnet_ids" { type = list(string) }
variable "db_name"            {}
variable "db_username"        {}
variable "db_password"        { sensitive = true }
variable "environment"        {}

locals {
  is_prod = var.environment == "production"
}

resource "aws_security_group" "rds" {
  name   = "${var.name}-rds-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]   # VPC CIDR only
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name}-db-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_db_instance" "postgres" {
  identifier        = "${var.name}-postgres"
  engine            = "postgres"
  engine_version    = "15.7"
  instance_class    = local.is_prod ? "db.t3.medium" : "db.t3.micro"
  allocated_storage = local.is_prod ? 100 : 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  multi_az               = local.is_prod
  backup_retention_period = local.is_prod ? 7 : 1
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  deletion_protection = local.is_prod
  skip_final_snapshot = !local.is_prod

  performance_insights_enabled = local.is_prod
}

output "endpoint"       { value = aws_db_instance.postgres.endpoint }
output "connection_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive = true
}
