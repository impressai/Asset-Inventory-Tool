"""extend notification config with events, threshold, recipients, frequency

Revision ID: 007
Revises: 006
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing = {c['name'] for c in inspector.get_columns('notification_config')}

    cols = {
        'notify_on_asset_created':  (sa.Boolean(), 'true'),
        'notify_on_asset_assigned': (sa.Boolean(), 'true'),
        'notify_on_asset_returned': (sa.Boolean(), 'true'),
        'notify_on_asset_deleted':  (sa.Boolean(), 'true'),
        'overdue_threshold_days':   (sa.Integer(), '0'),
        'email_recipients':         (sa.String(50), "'all'"),
        'email_frequency':          (sa.String(20), "'daily'"),
        'email_weekly_day':         (sa.Integer(), '0'),
    }
    for col_name, (col_type, default) in cols.items():
        if col_name not in existing:
            op.add_column('notification_config',
                sa.Column(col_name, col_type, nullable=False, server_default=default))


def downgrade():
    for col in ['notify_on_asset_created', 'notify_on_asset_assigned',
                'notify_on_asset_returned', 'notify_on_asset_deleted',
                'overdue_threshold_days', 'email_recipients',
                'email_frequency', 'email_weekly_day']:
        op.drop_column('notification_config', col)
