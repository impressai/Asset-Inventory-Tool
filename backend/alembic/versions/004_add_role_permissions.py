"""add role_permissions table

Revision ID: 004
Revises: 003
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None

DEFAULTS = {
    "admin":   {"create_asset": True,  "edit_asset": True,  "delete_asset": True,
                "assign_asset": True,  "return_asset": True, "import_assets": True,
                "export_assets": True, "view_reports": True, "manage_users": True},
    "manager": {"create_asset": True,  "edit_asset": True,  "delete_asset": False,
                "assign_asset": True,  "return_asset": True, "import_assets": True,
                "export_assets": True, "view_reports": True, "manage_users": False},
    "user":    {"create_asset": False, "edit_asset": False, "delete_asset": False,
                "assign_asset": False, "return_asset": False,"import_assets": False,
                "export_assets": True, "view_reports": True, "manage_users": False},
}

def upgrade():
    from sqlalchemy.engine.reflection import Inspector
    conn = op.get_bind()
    inspector = Inspector.from_engine(conn)
    if "role_permissions" in inspector.get_table_names():
        return

    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("permission", sa.String(100), nullable=False),
        sa.Column("allowed", sa.Boolean, nullable=False, default=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("role", "permission", name="uq_role_permission"),
    )

    import uuid
    rows = []
    for role, perms in DEFAULTS.items():
        for perm, allowed in perms.items():
            rows.append({"id": str(uuid.uuid4()), "role": role, "permission": perm, "allowed": allowed})
    op.bulk_insert(sa.table("role_permissions",
        sa.column("id", sa.String),
        sa.column("role", sa.String),
        sa.column("permission", sa.String),
        sa.column("allowed", sa.Boolean),
    ), rows)


def downgrade():
    op.drop_table("role_permissions")
