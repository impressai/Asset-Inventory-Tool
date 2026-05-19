"""add employee_id and designation to assignments

Revision ID: 002
Revises: 001
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    if 'assignments' not in inspector.get_table_names():
        return

    existing = [c['name'] for c in inspector.get_columns('assignments')]
    if 'employee_id' not in existing:
        op.add_column('assignments', sa.Column('employee_id', sa.String(100), nullable=True))
    if 'designation' not in existing:
        op.add_column('assignments', sa.Column('designation', sa.String(150), nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    if 'assignments' in inspector.get_table_names():
        existing = [c['name'] for c in inspector.get_columns('assignments')]
        if 'designation' in existing:
            op.drop_column('assignments', 'designation')
        if 'employee_id' in existing:
            op.drop_column('assignments', 'employee_id')
