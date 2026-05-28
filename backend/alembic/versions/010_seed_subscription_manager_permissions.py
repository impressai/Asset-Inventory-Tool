"""seed subscription_manager role permissions and manage_subscriptions key

Revision ID: 010
Revises: 009
Create Date: 2026-05-28
"""
import uuid
from alembic import op
import sqlalchemy as sa

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None

ALL_PERMISSIONS = [
    "create_asset", "edit_asset", "delete_asset", "assign_asset",
    "return_asset", "import_assets", "export_assets", "view_reports",
    "manage_users", "manage_subscriptions",
]


def upgrade():
    # Use fully-literal SQL to avoid psycopg2 enum-type parameter coercion issues.
    # All values here are controlled internally so no injection risk.

    # Enum labels are stored UPPERCASE in this DB (ADMIN, MANAGER, USER, SUBSCRIPTION_MANAGER)
    # Seed permission rows for SUBSCRIPTION_MANAGER
    for perm in ALL_PERMISSIONS:
        allowed_sql = 'true' if perm == 'manage_subscriptions' else 'false'
        op.execute(sa.text(f"""
            INSERT INTO role_permissions (id, role, permission, allowed)
            SELECT '{uuid.uuid4()}', 'SUBSCRIPTION_MANAGER', '{perm}', {allowed_sql}
            WHERE NOT EXISTS (
                SELECT 1 FROM role_permissions
                WHERE role::text = 'SUBSCRIPTION_MANAGER' AND permission = '{perm}'
            )
        """))

    # Seed manage_subscriptions for existing roles (MANAGER=enabled, USER=disabled)
    for role, allowed_sql in [("MANAGER", "true"), ("USER", "false")]:
        op.execute(sa.text(f"""
            INSERT INTO role_permissions (id, role, permission, allowed)
            SELECT '{uuid.uuid4()}', '{role}', 'manage_subscriptions', {allowed_sql}
            WHERE NOT EXISTS (
                SELECT 1 FROM role_permissions
                WHERE role::text = '{role}' AND permission = 'manage_subscriptions'
            )
        """))


def downgrade():
    op.execute(sa.text("DELETE FROM role_permissions WHERE role::text = 'SUBSCRIPTION_MANAGER'"))
    op.execute(sa.text("DELETE FROM role_permissions WHERE permission = 'manage_subscriptions'"))
