# ─────────────────────────────────────────────────────────────
# ECS Fargate Module — ALB + ECS Cluster + Service + Task
# ─────────────────────────────────────────────────────────────

variable "app_name"           {}
variable "environment"        {}
variable "aws_region"         {}
variable "vpc_id"             {}
variable "public_subnet_ids"  { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "backend_image_uri"  {}
variable "db_url"             { sensitive = true }
variable "secret_key"         { sensitive = true }
variable "s3_bucket_docs"     {}

locals {
  name = "${var.app_name}-${var.environment}"
}

# ─── Security Groups ─────────────────────────────────────────
resource "aws_security_group" "alb" {
  name   = "${local.name}-alb-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "backend" {
  name   = "${local.name}-backend-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── ALB ─────────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.name}-backend-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

# ─── ECS Cluster ─────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ─── IAM Role for ECS Task ───────────────────────────────────
resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name}-ecs-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ─── ECS Task Definition ─────────────────────────────────────
resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn

  container_definitions = jsonencode([{
    name      = "backend"
    image     = var.backend_image_uri
    essential = true

    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
      protocol      = "tcp"
    }]

    environment = [
      { name = "APP_ENV",          value = var.environment },
      { name = "DATABASE_URL",     value = var.db_url },
      { name = "SECRET_KEY",       value = var.secret_key },
      { name = "AWS_REGION",       value = var.aws_region },
      { name = "S3_BUCKET_DOCUMENTS", value = var.s3_bucket_docs },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = "/ecs/${local.name}-backend"
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval    = 30
      timeout     = 10
      retries     = 3
      startPeriod = 60
    }
  }])
}

# ─── CloudWatch Log Group ────────────────────────────────────
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}-backend"
  retention_in_days = 30
}

# ─── ECS Service ─────────────────────────────────────────────
resource "aws_ecs_service" "backend" {
  name            = "${local.name}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [task_definition]  # CD pipeline manages this
  }
}

# ─── Auto Scaling ─────────────────────────────────────────────
resource "aws_appautoscaling_target" "backend" {
  count              = var.environment == "production" ? 1 : 0
  max_capacity       = 6
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# ─── Outputs ─────────────────────────────────────────────────
output "alb_dns_name"    { value = aws_lb.main.dns_name }
output "ecs_cluster_name"{ value = aws_ecs_cluster.main.name }
output "ecs_service_name"{ value = aws_ecs_service.backend.name }
