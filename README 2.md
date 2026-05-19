# Asset Inventory Tool

A production-grade Asset Inventory Management System built with **React** (frontend), **Python FastAPI** (backend), **PostgreSQL** (database), containerized with **Docker**, deployed to **AWS ECS**, and managed via **GitHub Actions CI/CD**.

---

## 📁 Project Structure

```
asset-inventory/
├── frontend/               # React + Flexbox UI
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level pages
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API call layer (axios)
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # Helper functions
│   ├── Dockerfile
│   └── package.json
│
├── backend/                # Python FastAPI
│   ├── app/
│   │   ├── api/v1/         # REST API endpoints
│   │   ├── core/           # Config, security, auth
│   │   ├── db/             # Database session & base
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utilities (email, export)
│   ├── alembic/            # DB migrations
│   ├── tests/              # Pytest test suites
│   ├── Dockerfile
│   └── requirements.txt
│
├── infrastructure/
│   └── terraform/          # AWS IaC (ECS, RDS, VPC, S3)
│       ├── modules/        # Reusable Terraform modules
│       └── environments/   # dev / staging / prod configs
│
├── .github/
│   └── workflows/          # GitHub Actions CI/CD pipelines
│
├── docker-compose.yml      # Local development
├── docker-compose.prod.yml # Production-like local test
└── scripts/                # Dev utility scripts
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### 1. Clone & configure
```bash
git clone https://github.com/YOUR_ORG/asset-inventory.git
cd asset-inventory
cp .env.example .env
# Edit .env with your values
```

### 2. Start all services
```bash
docker compose up --build
```

| Service    | URL                        |
|------------|----------------------------|
| Frontend   | http://localhost:3000       |
| Backend API| http://localhost:8000       |
| API Docs   | http://localhost:8000/docs  |
| pgAdmin    | http://localhost:5050       |

### 3. Run DB migrations
```bash
docker compose exec backend alembic upgrade head
```

### 4. Seed initial admin user
```bash
docker compose exec backend python scripts/seed.py
```

---

## 🏗️ Architecture

```
                        ┌──────────────┐
                        │  CloudFront  │  (CDN)
                        └──────┬───────┘
                               │
                        ┌──────▼───────┐
                        │   S3 Bucket  │  (React static)
                        └──────────────┘

                        ┌──────────────┐
          HTTPS ───────▶│ ALB (AWS)    │
                        └──────┬───────┘
                               │
                  ┌────────────▼──────────────┐
                  │     ECS Fargate Cluster    │
                  │  ┌──────────────────────┐ │
                  │  │  FastAPI Container   │ │
                  │  └──────────┬───────────┘ │
                  └─────────────┼─────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │   RDS PostgreSQL (Multi-AZ)│
                  └───────────────────────────┘
                                │
                  ┌─────────────▼─────────────┐
                  │   S3 (Document Storage)    │
                  └───────────────────────────┘
```

---

## 🔐 User Roles

| Role    | Permissions                                      |
|---------|--------------------------------------------------|
| Admin   | Full CRUD on all modules, user management        |
| Manager | Assign assets, view all reports                  |
| User    | View own assigned assets only                    |

---

## 📦 Tech Stack

| Layer       | Technology                              |
|-------------|-----------------------------------------|
| Frontend    | React 18, TypeScript, Zustand, Axios    |
| Styling     | CSS Modules + Flexbox/Grid              |
| Backend     | Python 3.11, FastAPI, SQLAlchemy        |
| Auth        | JWT (access + refresh tokens), bcrypt   |
| Database    | PostgreSQL 15 (RDS in prod)             |
| Migrations  | Alembic                                 |
| Container   | Docker, Docker Compose                  |
| CI/CD       | GitHub Actions                          |
| Cloud       | AWS ECS Fargate, RDS, S3, CloudFront   |
| IaC         | Terraform                               |
| Monitoring  | AWS CloudWatch                          |

---

## 🔄 CI/CD Pipeline

```
Push to feature/* → PR → Lint + Test
Merge to develop  → Build + Deploy to dev
Merge to main     → Build + Deploy to production
```

See `.github/workflows/` for full pipeline details.

---

## 📄 API Documentation

Interactive Swagger docs available at `/docs` when backend is running.

Key endpoint groups:
- `POST /api/v1/auth/login` — JWT login
- `GET/POST /api/v1/assets` — Asset CRUD
- `GET/POST /api/v1/assignments` — Assign/unassign
- `GET /api/v1/reports/summary` — Reports
- `GET /api/v1/history/{asset_id}` — Audit trail

---

## 🌍 Environment Variables

See `.env.example` for all required variables.
