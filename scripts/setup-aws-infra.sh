#!/bin/bash
# =============================================================
#  Asset Inventory — AWS ECS Infrastructure Setup
#  Cost-optimised: Fargate Spot + public subnets (no NAT GW)
#  Estimated cost: ~$22-28/month total
#  Run: chmod +x setup-aws-infra.sh && ./setup-aws-infra.sh
# =============================================================

set -e

# ── Config — edit these before running ───────────────────────
AWS_REGION="ap-south-1"
PROJECT="asset-inventory"
DOMAIN=""                        # optional: yourdomain.com (leave empty if no domain yet)
DB_PASSWORD="ChangeMe123!"       # CHANGE THIS
SECRET_KEY="$(openssl rand -hex 32)"
SMTP_USER=""                     # your Gmail address
SMTP_PASSWORD=""                 # Gmail app password

# ── Colours ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
die()     { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

# ── Preflight ─────────────────────────────────────────────────
command -v aws  >/dev/null || die "AWS CLI not installed. Install from https://aws.amazon.com/cli/"
command -v jq   >/dev/null || die "jq not installed. Run: brew install jq  (or apt install jq)"
aws sts get-caller-identity >/dev/null || die "AWS credentials not configured. Run: aws configure"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
info "Account: $ACCOUNT_ID  Region: $AWS_REGION"
echo ""

# ─────────────────────────────────────────────────────────────
# 1. VPC + Networking
# ─────────────────────────────────────────────────────────────
info "1/9  Creating VPC..."

VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${PROJECT}-vpc}]" \
  --region $AWS_REGION \
  --query 'Vpc.VpcId' --output text)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support --region $AWS_REGION
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames --region $AWS_REGION
success "VPC: $VPC_ID"

# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${PROJECT}-igw}]" \
  --region $AWS_REGION \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID --region $AWS_REGION
success "Internet Gateway: $IGW_ID"

# Two public subnets (ALB requires 2 AZs)
AZ1="${AWS_REGION}a"
AZ2="${AWS_REGION}b"

SUBNET1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone $AZ1 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT}-public-1}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' --output text)
aws ec2 modify-subnet-attribute --subnet-id $SUBNET1 --map-public-ip-on-launch --region $AWS_REGION

SUBNET2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone $AZ2 \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${PROJECT}-public-2}]" \
  --region $AWS_REGION \
  --query 'Subnet.SubnetId' --output text)
aws ec2 modify-subnet-attribute --subnet-id $SUBNET2 --map-public-ip-on-launch --region $AWS_REGION
success "Subnets: $SUBNET1 | $SUBNET2"

# Route table
RT_ID=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${PROJECT}-rt}]" \
  --region $AWS_REGION \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $RT_ID --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID --region $AWS_REGION >/dev/null
aws ec2 associate-route-table --route-table-id $RT_ID --subnet-id $SUBNET1 --region $AWS_REGION >/dev/null
aws ec2 associate-route-table --route-table-id $RT_ID --subnet-id $SUBNET2 --region $AWS_REGION >/dev/null
success "Route table configured"

# ─────────────────────────────────────────────────────────────
# 2. Security Groups
# ─────────────────────────────────────────────────────────────
info "2/9  Creating security groups..."

# ALB — open 80 and 443 to world
ALB_SG=$(aws ec2 create-security-group \
  --group-name "${PROJECT}-alb-sg" --description "ALB security group" \
  --vpc-id $VPC_ID --region $AWS_REGION \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80  --cidr 0.0.0.0/0 --region $AWS_REGION >/dev/null
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0 --region $AWS_REGION >/dev/null

# ECS tasks — only traffic from ALB
ECS_SG=$(aws ec2 create-security-group \
  --group-name "${PROJECT}-ecs-sg" --description "ECS tasks security group" \
  --vpc-id $VPC_ID --region $AWS_REGION \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 8000 --source-group $ALB_SG --region $AWS_REGION >/dev/null
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 80   --source-group $ALB_SG --region $AWS_REGION >/dev/null

# RDS — only from ECS tasks
RDS_SG=$(aws ec2 create-security-group \
  --group-name "${PROJECT}-rds-sg" --description "RDS security group" \
  --vpc-id $VPC_ID --region $AWS_REGION \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $ECS_SG --region $AWS_REGION >/dev/null

success "SGs — ALB: $ALB_SG | ECS: $ECS_SG | RDS: $RDS_SG"

# ─────────────────────────────────────────────────────────────
# 3. RDS PostgreSQL (db.t3.micro — free tier eligible for new accounts)
# ─────────────────────────────────────────────────────────────
info "3/9  Creating RDS PostgreSQL (db.t3.micro)..."

# Subnet group needs 2 AZs
aws rds create-db-subnet-group \
  --db-subnet-group-name "${PROJECT}-db-subnet" \
  --db-subnet-group-description "Asset Inventory DB subnet group" \
  --subnet-ids $SUBNET1 $SUBNET2 \
  --region $AWS_REGION >/dev/null

aws rds create-db-instance \
  --db-instance-identifier "${PROJECT}-db" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version "15.4" \
  --master-username asset_user \
  --master-user-password "$DB_PASSWORD" \
  --db-name asset_inventory \
  --allocated-storage 20 \
  --storage-type gp2 \
  --no-multi-az \
  --no-publicly-accessible \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name "${PROJECT}-db-subnet" \
  --backup-retention-period 7 \
  --deletion-protection \
  --tags "Key=Name,Value=${PROJECT}-db" \
  --region $AWS_REGION >/dev/null

warn "RDS is being created (takes ~5 min). Continuing setup in parallel..."

# ─────────────────────────────────────────────────────────────
# 4. ECR Repositories
# ─────────────────────────────────────────────────────────────
info "4/9  Creating ECR repositories..."

aws ecr create-repository --repository-name "${PROJECT}-backend"  --region $AWS_REGION >/dev/null 2>&1 || warn "ECR backend repo already exists"
aws ecr create-repository --repository-name "${PROJECT}-frontend" --region $AWS_REGION >/dev/null 2>&1 || warn "ECR frontend repo already exists"

# Lifecycle policy — keep only last 5 images to save storage cost
LIFECYCLE_POLICY='{"rules":[{"rulePriority":1,"description":"Keep last 5","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":5},"action":{"type":"expire"}}]}'
aws ecr put-lifecycle-policy --repository-name "${PROJECT}-backend"  --lifecycle-policy-text "$LIFECYCLE_POLICY" --region $AWS_REGION >/dev/null
aws ecr put-lifecycle-policy --repository-name "${PROJECT}-frontend" --lifecycle-policy-text "$LIFECYCLE_POLICY" --region $AWS_REGION >/dev/null
success "ECR repos created with 5-image lifecycle policy"

# ─────────────────────────────────────────────────────────────
# 5. IAM Roles
# ─────────────────────────────────────────────────────────────
info "5/9  Creating IAM roles..."

# ECS Task Execution Role (pulls images, writes logs, reads secrets)
TRUST_POLICY='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

EXEC_ROLE_ARN=$(aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' --output text 2>/dev/null \
  || aws iam get-role --role-name ecsTaskExecutionRole --query 'Role.Arn' --output text)
aws iam attach-role-policy --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy 2>/dev/null || true

# Allow reading Secrets Manager
aws iam put-role-policy --role-name ecsTaskExecutionRole \
  --policy-name SecretsAccess \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"secretsmanager:GetSecretValue\"],\"Resource\":\"arn:aws:secretsmanager:${AWS_REGION}:${ACCOUNT_ID}:secret:${PROJECT}-prod*\"}]}" 2>/dev/null || true

# ECS Task Role (app-level AWS access — S3 etc.)
TASK_ROLE_ARN=$(aws iam create-role \
  --role-name "${PROJECT}-task-role" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' --output text 2>/dev/null \
  || aws iam get-role --role-name "${PROJECT}-task-role" --query 'Role.Arn' --output text)
aws iam put-role-policy --role-name "${PROJECT}-task-role" \
  --policy-name S3Access \
  --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"s3:PutObject\",\"s3:GetObject\",\"s3:DeleteObject\"],\"Resource\":\"arn:aws:s3:::${PROJECT}-documents/*\"}]}" 2>/dev/null || true

success "IAM roles ready — Exec: $EXEC_ROLE_ARN"

# ─────────────────────────────────────────────────────────────
# 6. Secrets Manager
# ─────────────────────────────────────────────────────────────
info "6/9  Creating Secrets Manager secret..."

SECRET_VALUE=$(cat <<EOF
{
  "SECRET_KEY": "${SECRET_KEY}",
  "DATABASE_URL": "postgresql://asset_user:${DB_PASSWORD}@REPLACE_WITH_RDS_ENDPOINT:5432/asset_inventory",
  "POSTGRES_PASSWORD": "${DB_PASSWORD}",
  "SMTP_USER": "${SMTP_USER}",
  "SMTP_PASSWORD": "${SMTP_PASSWORD}"
}
EOF
)

SECRET_ARN=$(aws secretsmanager create-secret \
  --name "${PROJECT}-prod" \
  --description "Asset Inventory production secrets" \
  --secret-string "$SECRET_VALUE" \
  --region $AWS_REGION \
  --query 'ARN' --output text 2>/dev/null \
  || aws secretsmanager describe-secret --secret-id "${PROJECT}-prod" --region $AWS_REGION --query 'ARN' --output text)
success "Secret ARN: $SECRET_ARN"

# ─────────────────────────────────────────────────────────────
# 7. CloudWatch Log Groups
# ─────────────────────────────────────────────────────────────
info "7/9  Creating CloudWatch log groups..."
aws logs create-log-group --log-group-name "/ecs/${PROJECT}-backend"  --region $AWS_REGION 2>/dev/null || true
aws logs create-log-group --log-group-name "/ecs/${PROJECT}-frontend" --region $AWS_REGION 2>/dev/null || true
aws logs put-retention-policy --log-group-name "/ecs/${PROJECT}-backend"  --retention-in-days 14 --region $AWS_REGION
aws logs put-retention-policy --log-group-name "/ecs/${PROJECT}-frontend" --retention-in-days 14 --region $AWS_REGION
success "Log groups created (14-day retention)"

# ─────────────────────────────────────────────────────────────
# 8. ECS Cluster with Fargate Spot
# ─────────────────────────────────────────────────────────────
info "8/9  Creating ECS cluster..."

aws ecs create-cluster \
  --cluster-name "${PROJECT}-cluster" \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=4,base=0 \
    capacityProvider=FARGATE,weight=1,base=1 \
  --settings name=containerInsights,value=disabled \
  --region $AWS_REGION >/dev/null

success "ECS cluster created: ${PROJECT}-cluster"
warn "Capacity strategy: 80% Fargate Spot + 20% Fargate (base=1 ensures availability)"

# ─────────────────────────────────────────────────────────────
# 9. ALB + Target Groups
# ─────────────────────────────────────────────────────────────
info "9/9  Creating Application Load Balancer..."

ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${PROJECT}-alb" \
  --type application \
  --scheme internet-facing \
  --ip-address-type ipv4 \
  --subnets $SUBNET1 $SUBNET2 \
  --security-groups $ALB_SG \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --region $AWS_REGION \
  --query 'LoadBalancers[0].DNSName' --output text)

# Backend target group (port 8000)
TG_BACKEND=$(aws elbv2 create-target-group \
  --name "${PROJECT}-backend-tg" \
  --protocol HTTP --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Frontend target group (port 80)
TG_FRONTEND=$(aws elbv2 create-target-group \
  --name "${PROJECT}-frontend-tg" \
  --protocol HTTP --port 80 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Listener on port 80: /api/* → backend, everything else → frontend
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_FRONTEND \
  --region $AWS_REGION \
  --query 'Listeners[0].ListenerArn' --output text)

# API path rule (higher priority = evaluated first)
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 10 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$TG_BACKEND \
  --region $AWS_REGION >/dev/null

success "ALB: $ALB_DNS"

# ─────────────────────────────────────────────────────────────
# Wait for RDS and get endpoint
# ─────────────────────────────────────────────────────────────
info "Waiting for RDS to be available..."
aws rds wait db-instance-available --db-instance-identifier "${PROJECT}-db" --region $AWS_REGION
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "${PROJECT}-db" \
  --region $AWS_REGION \
  --query 'DBInstances[0].Endpoint.Address' --output text)

# Update the DATABASE_URL secret now that we have the endpoint
aws secretsmanager update-secret \
  --secret-id "${PROJECT}-prod" \
  --secret-string "{
    \"SECRET_KEY\": \"${SECRET_KEY}\",
    \"DATABASE_URL\": \"postgresql://asset_user:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/asset_inventory\",
    \"POSTGRES_PASSWORD\": \"${DB_PASSWORD}\",
    \"SMTP_USER\": \"${SMTP_USER}\",
    \"SMTP_PASSWORD\": \"${SMTP_PASSWORD}\"
  }" \
  --region $AWS_REGION >/dev/null
success "RDS endpoint: $RDS_ENDPOINT — secret updated"

# ─────────────────────────────────────────────────────────────
# Patch task definition files with real values
# ─────────────────────────────────────────────────────────────
info "Updating task definition files..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

sed -i.bak \
  -e "s|<ACCOUNT_ID>|${ACCOUNT_ID}|g" \
  -e "s|<RDS_ENDPOINT>|${RDS_ENDPOINT}|g" \
  -e "s|yourdomain.com|${ALB_DNS}|g" \
  -e "s|noreply@yourdomain.com|noreply@${ALB_DNS}|g" \
  -e "s|/ecs/asset-backend|/ecs/${PROJECT}-backend|g" \
  -e "s|/ecs/asset-frontend|/ecs/${PROJECT}-frontend|g" \
  "${REPO_ROOT}/ecs/backend-task-def.json" \
  "${REPO_ROOT}/ecs/frontend-task-def.json"

# Fix secret ARN paths to match our secret name
sed -i.bak \
  -e "s|asset-inventory-prod|${PROJECT}-prod|g" \
  "${REPO_ROOT}/ecs/backend-task-def.json"

# Fix task role ARN
sed -i.bak \
  -e "s|ecsTaskRole|${PROJECT}-task-role|g" \
  "${REPO_ROOT}/ecs/backend-task-def.json"

# Fix log group names in task defs
sed -i.bak \
  -e "s|asset-inventory-backend|${PROJECT}-backend|g" \
  "${REPO_ROOT}/ecs/backend-task-def.json"
sed -i.bak \
  -e "s|asset-inventory-frontend|${PROJECT}-frontend|g" \
  "${REPO_ROOT}/ecs/frontend-task-def.json"

rm -f "${REPO_ROOT}/ecs/"*.bak

# Register task definitions
BACKEND_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${REPO_ROOT}/ecs/backend-task-def.json" \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' --output text)

FRONTEND_TASK_DEF_ARN=$(aws ecs register-task-definition \
  --cli-input-json "file://${REPO_ROOT}/ecs/frontend-task-def.json" \
  --region $AWS_REGION \
  --query 'taskDefinition.taskDefinitionArn' --output text)

success "Task defs registered"

# ─────────────────────────────────────────────────────────────
# Create ECS Services
# ─────────────────────────────────────────────────────────────
info "Creating ECS services..."

# Backend service
aws ecs create-service \
  --cluster "${PROJECT}-cluster" \
  --service-name "asset-backend-service" \
  --task-definition "$BACKEND_TASK_DEF_ARN" \
  --desired-count 1 \
  --launch-type FARGATE \
  --capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=1,base=0 \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET1},${SUBNET2}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=${TG_BACKEND},containerName=backend,containerPort=8000" \
  --health-check-grace-period-seconds 120 \
  --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200" \
  --region $AWS_REGION >/dev/null

# Frontend service
aws ecs create-service \
  --cluster "${PROJECT}-cluster" \
  --service-name "asset-frontend-service" \
  --task-definition "$FRONTEND_TASK_DEF_ARN" \
  --desired-count 1 \
  --launch-type FARGATE \
  --capacity-provider-strategy \
    capacityProvider=FARGATE_SPOT,weight=1,base=0 \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNET1},${SUBNET2}],securityGroups=[${ECS_SG}],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=${TG_FRONTEND},containerName=frontend,containerPort=80" \
  --health-check-grace-period-seconds 60 \
  --deployment-configuration "minimumHealthyPercent=50,maximumPercent=200" \
  --region $AWS_REGION >/dev/null

success "ECS services created"

# ─────────────────────────────────────────────────────────────
# Save values for GitHub Actions secrets
# ─────────────────────────────────────────────────────────────
OUTPUT_FILE="${SCRIPT_DIR}/infra-output.txt"
cat > "$OUTPUT_FILE" <<EOF
================================================
  INFRASTRUCTURE SETUP COMPLETE
================================================

ALB URL (use this until you add a domain):
  http://${ALB_DNS}

RDS Endpoint:
  ${RDS_ENDPOINT}

ECS Cluster:
  ${PROJECT}-cluster

-------- GITHUB SECRETS TO ADD ----------------
Go to: GitHub repo → Settings → Secrets → Actions

AWS_ACCESS_KEY_ID       = <your IAM user access key>
AWS_SECRET_ACCESS_KEY   = <your IAM user secret key>
REACT_APP_API_BASE_URL  = http://${ALB_DNS}/api/v1
ECS_SUBNET_ID           = ${SUBNET1}
ECS_SECURITY_GROUP_ID   = ${ECS_SG}

-------- COST ESTIMATE (~monthly) -------------
ECS Fargate Spot backend  : ~$4-5
ECS Fargate Spot frontend : ~$2
ALB                       : ~$16-18
RDS db.t3.micro           : ~$13 (FREE for 12 months if new account)
ECR storage               : ~$0 (first 500MB free)
Data transfer             : ~$1-2
----------------------------------------------
TOTAL                     : ~$22-40/month
  (FREE TIER: ~$22-27/month if new AWS account)

================================================
Saved to: ${OUTPUT_FILE}
EOF

cat "$OUTPUT_FILE"
