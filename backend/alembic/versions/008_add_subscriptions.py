"""add subscriptions table

Revision ID: 008
Revises: 007
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy.engine.reflection import Inspector

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    if 'subscriptions' in Inspector.from_engine(conn).get_table_names():
        return
    op.create_table(
        'subscriptions',
        sa.Column('id',               postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('name',             sa.String(255),  nullable=False),
        sa.Column('vendor',           sa.String(255),  nullable=True),
        sa.Column('category',         sa.String(100),  nullable=True),
        sa.Column('plan_name',        sa.String(100),  nullable=True),
        sa.Column('num_licenses',     sa.Integer(),    nullable=True),
        sa.Column('cost_per_license', sa.Float(),      nullable=True),
        sa.Column('billing_cycle',    sa.String(50),   nullable=True),
        sa.Column('total_cost',       sa.Float(),      nullable=True),
        sa.Column('start_date',       sa.Date(),       nullable=True),
        sa.Column('renewal_date',     sa.Date(),       nullable=True),
        sa.Column('auto_renew',       sa.Boolean(),    nullable=False, server_default='false'),
        sa.Column('status',           sa.String(50),   nullable=False, server_default='active'),
        sa.Column('notes',            sa.Text(),       nullable=True),
        sa.Column('is_active',        sa.Boolean(),    nullable=False, server_default='true'),
        sa.Column('created_at',       sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at',       sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('subscriptions')
