"""add notification config table

Revision ID: 006
Revises: 005
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    if 'notification_config' not in inspector.get_table_names():
        op.create_table(
            'notification_config',
            sa.Column('id',                sa.Integer(),  primary_key=True),
            sa.Column('warranty_enabled',  sa.Boolean(),  nullable=False, server_default='true'),
            sa.Column('warranty_days',     sa.Integer(),  nullable=False, server_default='30'),
            sa.Column('license_enabled',   sa.Boolean(),  nullable=False, server_default='true'),
            sa.Column('license_days',      sa.Integer(),  nullable=False, server_default='30'),
            sa.Column('overdue_enabled',   sa.Boolean(),  nullable=False, server_default='true'),
            sa.Column('email_enabled',     sa.Boolean(),  nullable=False, server_default='true'),
            sa.Column('email_send_hour',   sa.Integer(),  nullable=False, server_default='20'),
            sa.Column('email_send_minute', sa.Integer(),  nullable=False, server_default='0'),
            sa.Column('updated_at',        sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        # Insert the single default row
        op.execute(
            "INSERT INTO notification_config (id, warranty_enabled, warranty_days, "
            "license_enabled, license_days, overdue_enabled, email_enabled, "
            "email_send_hour, email_send_minute) "
            "VALUES (1, true, 30, true, 30, true, true, 20, 0)"
        )


def downgrade():
    op.drop_table('notification_config')
