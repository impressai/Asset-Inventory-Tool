"""Integration tests: role-based access control on notifications and permissions."""

import pytest


class TestNotificationsAccessControl:
    """All notification endpoints must require manager or admin."""

    ENDPOINTS = [
        "/api/v1/notifications/warranty-expiring",
        "/api/v1/notifications/software-expiring",
        "/api/v1/notifications/overdue-assignments",
        "/api/v1/notifications/subscriptions-expiring",
    ]

    def test_regular_user_cannot_access_warranty_expiring(self, client, user_auth):
        resp = client.get("/api/v1/notifications/warranty-expiring", headers=user_auth)
        assert resp.status_code == 403

    def test_regular_user_cannot_access_software_expiring(self, client, user_auth):
        resp = client.get("/api/v1/notifications/software-expiring", headers=user_auth)
        assert resp.status_code == 403

    def test_regular_user_cannot_access_overdue_assignments(self, client, user_auth):
        resp = client.get("/api/v1/notifications/overdue-assignments", headers=user_auth)
        assert resp.status_code == 403

    def test_regular_user_cannot_access_subscriptions_expiring(self, client, user_auth):
        resp = client.get("/api/v1/notifications/subscriptions-expiring", headers=user_auth)
        assert resp.status_code == 403

    def test_manager_can_access_warranty_expiring(self, client, manager_auth):
        resp = client.get("/api/v1/notifications/warranty-expiring", headers=manager_auth)
        assert resp.status_code == 200

    def test_manager_can_access_overdue_assignments(self, client, manager_auth):
        resp = client.get("/api/v1/notifications/overdue-assignments", headers=manager_auth)
        assert resp.status_code == 200

    def test_admin_can_access_all_endpoints(self, client, admin_auth):
        for endpoint in self.ENDPOINTS:
            resp = client.get(endpoint, headers=admin_auth)
            assert resp.status_code == 200, f"Admin blocked from {endpoint}"

    def test_send_alerts_requires_admin(self, client, manager_auth, user_auth):
        """POST /send-alerts is admin-only."""
        resp = client.post("/api/v1/notifications/send-alerts", headers=manager_auth)
        assert resp.status_code == 403
        resp = client.post("/api/v1/notifications/send-alerts", headers=user_auth)
        assert resp.status_code == 403

    def test_unauthenticated_blocked(self, client):
        for endpoint in self.ENDPOINTS:
            resp = client.get(endpoint)
            assert resp.status_code == 401, f"Unauthenticated allowed on {endpoint}"


class TestRolePermissionsAccessControl:
    """GET /role-permissions must be admin-only."""

    def test_regular_user_cannot_read_permissions(self, client, user_auth):
        resp = client.get("/api/v1/role-permissions", headers=user_auth)
        assert resp.status_code == 403

    def test_manager_cannot_read_permissions(self, client, manager_auth):
        resp = client.get("/api/v1/role-permissions", headers=manager_auth)
        assert resp.status_code == 403

    def test_admin_can_read_permissions(self, client, admin_auth):
        resp = client.get("/api/v1/role-permissions", headers=admin_auth)
        assert resp.status_code == 200
        data = resp.json()
        assert "admin" in data
        assert "manager" in data

    def test_regular_user_cannot_update_permissions(self, client, user_auth):
        resp = client.put("/api/v1/role-permissions", headers=user_auth, json={})
        assert resp.status_code == 403

    def test_unauthenticated_blocked_on_permissions(self, client):
        resp = client.get("/api/v1/role-permissions")
        assert resp.status_code == 401


class TestCORSHeaders:
    """Security headers should be present on all responses."""

    def test_x_content_type_options_present(self, client):
        resp = client.get("/health")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options_deny(self, client):
        resp = client.get("/health")
        assert resp.headers.get("x-frame-options") == "DENY"

    def test_referrer_policy_present(self, client):
        resp = client.get("/health")
        assert "referrer-policy" in resp.headers
