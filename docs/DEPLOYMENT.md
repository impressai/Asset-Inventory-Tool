# Deployment Guide — Asset Inventory Tool

## Prerequisites

Before deploying, ensure you have:
- AWS CLI configured with appropriate permissions
- Terraform >= 1.8.0 installed
- Docker installed and running
- GitHub repository with secrets configured

---

## Step 1 — GitHub Repository Secrets

Navigate to **Settings → Secrets and Variables → Actions** and add:

| Secret Name                  | Description                          |
|------------------------------|--------------------------------------|
| `AWS_ACCESS_KEY_ID`          | IAM user access key                  |
| `AWS_SECRET_ACCESS_KEY`      | IAM user secret key                  |
| `AWS_ACCOUNT_ID`             | Your 12-digit AWS account ID         |
| `AWS_REGION`                 | e.g. `ap-south-1`                    |
| `ECR_REPO_BACKEND`           | e.g. `asset-inventory/backend`       |
| `ECR_REPO_FRONTEND`          | e.g. `asset-inventory/frontend`      |
| `S3_BUCKET_FRONTEND_PROD`    | S3 bucket name for React (prod)      |
| `S3_BUCKET_FRONTEND_DEV`     | S3 bucket name for React (dev)       |
| `CLOUDFRONT_ID_PROD`         | CloudFront distribution ID (prod)    |
| `CLOUDFRONT_ID_DEV`          | CloudFront distribution ID (dev)     |
| `ECS_CLUSTER_PROD`           | ECS cluster name (prod)              |
| `ECS_CLUSTER_DEV`            | ECS cluster name (dev)               |
| `ECS_SERVICE_BACKEND_PROD`   | ECS service name (prod)              |
| `ECS_SERVICE_BACKEND_DEV`    | ECS service name (dev)               |

---

## Step 2 — Create ECR Repositories

```bash
aws ecr create-repository --repository-name asset-inventory/backend --region ap-south-1
aws ecr create-repository --repository-name asset-inventory/frontend --region ap-south-1
```

---

## Step 3 — Create Terraform State Bucket

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://your-terraform-state-bucket --region ap-south-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name terraform-state-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

---

## Step 4 — Provision Infrastructure with Terraform

```bash
cd infrastructure/terraform

# Initialize
terraform init

# Review plan
terraform plan \
  -var="db_password=YOUR_STRONG_DB_PASSWORD" \
  -var="secret_key=YOUR_JWT_SECRET_KEY_32_CHARS_MIN" \
  -var="backend_image_uri=ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/asset-inventory/backend:latest"

# Apply
terraform apply \
  -var="db_password=YOUR_STRONG_DB_PASSWORD" \
  -var="secret_key=YOUR_JWT_SECRET_KEY_32_CHARS_MIN" \
  -var="backend_image_uri=ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com/asset-inventory/backend:latest"
```

Note the outputs — you'll need `alb_dns_name`, `cloudfront_id`, etc. to fill in GitHub secrets.

---

## Step 5 — Initial Deploy (Manual)

Push to `develop` to trigger the first deployment:
```bash
git push origin develop
```

Watch the GitHub Actions **CD — Deploy** workflow complete.

---

## Step 6 — Run Database Migrations

```bash
# Via ECS exec (after first deploy)
aws ecs execute-command \
  --cluster asset-inventory-production-cluster \
  --task <TASK_ARN> \
  --container backend \
  --interactive \
  --command "alembic upgrade head"
```

---

## Step 7 — Create Admin User

```bash
aws ecs execute-command \
  --cluster asset-inventory-production-cluster \
  --task <TASK_ARN> \
  --container backend \
  --interactive \
  --command "python scripts/seed.py"
```

---

## Branch → Environment Mapping

| Branch    | Environment | API URL                          |
|-----------|-------------|----------------------------------|
| `develop` | dev         | `https://api-dev.yourcompany.com`|
| `main`    | production  | `https://api.yourcompany.com`    |

---

## Local Development

```bash
# Start all services
docker compose up --build

# Run migrations
docker compose exec backend alembic upgrade head

# Seed admin user
docker compose exec backend python scripts/seed.py

# Run backend tests
docker compose exec backend pytest tests/ -v

# Run frontend tests
docker compose exec frontend npm test
```

---

## Updating the Application

Simply push commits:
- Feature branches → PR → CI runs (lint + test + build)
- Merge to `develop` → Auto-deploy to dev
- Merge to `main` → Auto-deploy to production

The CD pipeline handles:
1. Building and pushing Docker images to ECR
2. Running Alembic migrations
3. Deploying new ECS task definitions
4. Syncing React build to S3
5. Invalidating CloudFront cache
