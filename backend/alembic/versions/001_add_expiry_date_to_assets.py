"""add expiry_date to assets

Revision ID: 001
Revises:
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # Fresh install: assets table doesn't exist yet — create_all() will handle it
    if 'assets' not in inspector.get_table_names():
        return

    existing = [c['name'] for c in inspector.get_columns('assets')]
    if 'expiry_date' not in existing:
        op.add_column('assets', sa.Column('expiry_date', sa.Date(), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'assets' in inspector.get_table_names():
        existing = [c['name'] for c in inspector.get_columns('assets')]
        if 'expiry_date' in existing:
            op.drop_column('assets', 'expiry_date')
