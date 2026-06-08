# ─────────────────────────────────────────────────────────────
# Backend Dockerfile — Multi-stage (development + production)
# ─────────────────────────────────────────────────────────────

# ── Base Stage ───────────────────────────────────────────────
FROM python:3.11-slim AS base

LABEL maintainer="your-team@yourcompany.com"
LABEL description="Asset Inventory - FastAPI Backend"

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app

# ── Development Stage ────────────────────────────────────────
FROM base AS development

# Install dev-only dependencies
RUN pip install --no-cache-dir \
    pytest \
    pytest-asyncio \
    pytest-cov \
    httpx \
    ruff \
    mypy

USER appuser

EXPOSE 8000

# --reload enables hot-reload (overridden by docker-compose command)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production Stage ─────────────────────────────────────────
FROM base AS production

RUN pip install --no-cache-dir gunicorn

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && chown appuser:appgroup /entrypoint.sh

USER appuser

EXPOSE 8000

# Health check for ECS
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
