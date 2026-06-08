"""No-op migration — the role_permissions data is correct (UPPERCASE enum labels).
The actual fix was in deps.py: check_permission now passes the enum member directly
instead of .value (lowercase), so SQLAlchemy maps it to the correct 'MANAGER' label.

Revision ID: 012
Revises: 011
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa

revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    pass  # data was always correct; bug was in deps.py not the DB


def downgrade():
    pass
