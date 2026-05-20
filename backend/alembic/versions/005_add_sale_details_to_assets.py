"""add sale details to assets

Revision ID: 005
Revises: 004
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    existing = {c['name'] for c in inspector.get_columns('assets')}

    cols = {
        'sale_date':           sa.Date(),
        'buyer_name':          sa.String(255),
        'buyer_email':         sa.String(255),
        'buyer_contact':       sa.String(100),
        'sale_price':          sa.Float(),
        'sale_invoice_number': sa.String(100),
        'sale_notes':          sa.Text(),
    }
    for col_name, col_type in cols.items():
        if col_name not in existing:
            op.add_column('assets', sa.Column(col_name, col_type, nullable=True))


def downgrade():
    for col in ['sale_date', 'buyer_name', 'buyer_email', 'buyer_contact',
                'sale_price', 'sale_invoice_number', 'sale_notes']:
        op.drop_column('assets', col)
