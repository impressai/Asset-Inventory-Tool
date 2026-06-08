"""add licenses_used to subscriptions

Revision ID: 011
Revises: 010
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    cols = [c['name'] for c in Inspector.from_engine(conn).get_columns('subscriptions')]
    if 'licenses_used' not in cols:
        op.add_column(
            'subscriptions',
            sa.Column('licenses_used', sa.Integer(), nullable=False, server_default='0'),
        )


def downgrade():
    op.drop_column('subscriptions', 'licenses_used')
