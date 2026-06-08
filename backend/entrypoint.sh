#!/bin/sh
set -e

echo "==> Waiting for database..."
MAX_RETRIES=30
COUNT=0
until python -c "
import sys, os
url = os.environ.get('DATABASE_URL', '')
host = url.split('@')[-1].split('/')[0] if '@' in url else '(not set)'
print('==> Connecting to:', host, flush=True)
from sqlalchemy import create_engine, text
try:
    e = create_engine(url)
    with e.connect() as c:
        c.execute(text('SELECT 1'))
    sys.exit(0)
except Exception as ex:
    print('==> DB error:', ex, flush=True)
    sys.exit(1)
"; do
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
        echo "==> Database not reachable after ${MAX_RETRIES} attempts. Aborting."
        exit 1
    fi
    echo "==> DB not ready (attempt ${COUNT}/${MAX_RETRIES}), retrying in 2s..."
    sleep 2
done
echo "==> Database is ready."

echo "==> Creating base tables..."
python -c "
import sys
sys.path.insert(0, '/app')
from app.db.base import Base
from app.db.session import engine
Base.metadata.create_all(bind=engine)
print('==> Base tables ready.')
"

echo "==> Running Alembic migrations..."
python -m alembic upgrade head
echo "==> Migrations complete."

exec gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers 4 \
    --bind "0.0.0.0:${PORT:-8000}" \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
