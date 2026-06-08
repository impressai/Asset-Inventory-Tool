#!/bin/sh
set -e

echo "==> Running Alembic migrations..."
python -m alembic upgrade head
echo "==> Migrations complete."

exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
