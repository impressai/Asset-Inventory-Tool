"""add license_start_date to assets

Revision ID: 003
Revises: 002
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'assets' not in inspector.get_table_names():
        return
    existing = [c['name'] for c in inspector.get_columns('assets')]
    if 'license_start_date' not in existing:
        op.add_column('assets', sa.Column('license_start_date', sa.Date(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'assets' in inspector.get_table_names():
        existing = [c['name'] for c in inspector.get_columns('assets')]
        if 'license_start_date' in existing:
            op.drop_column('assets', 'license_start_date')
