"""add subscription_manager enum value to userrole

Revision ID: 009
Revises: 008
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # PostgreSQL enum labels follow the UPPER naming convention in this project
    # (existing values: ADMIN, MANAGER, USER). Add SUBSCRIPTION_MANAGER to match.
    # ALTER TYPE is DDL and cannot be rolled back; data seeding is in migration 010.
    op.execute(sa.text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_MANAGER'"))


def downgrade():
    # PostgreSQL does not support removing enum values directly.
    pass
