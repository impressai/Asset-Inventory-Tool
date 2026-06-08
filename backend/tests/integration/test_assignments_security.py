"""Integration tests: assignment endpoint security — schema enforcement, email validation."""

import pytest
import uuid
from unittest.mock import patch


def _create_asset(client, headers, tag_suffix="") -> str:
    resp = client.post(
        "/api/v1/assets",
        json={
            "asset_tag": f"AST-SEC-{tag_suffix or uuid.uuid4().hex[:6].upper()}",
            "name": "Test Asset for Security",
            "category": "Laptop",
            "condition": "new",
        },
        headers=headers,
    )
    assert resp.status_code == 201, f"Asset creation failed: {resp.text}"
    return resp.json()["id"]


def _create_assignment(client, headers, asset_id: str) -> str:
    resp = client.post(
        "/api/v1/assignments",
        json={
            "asset_id": asset_id,
            "assignee_name": "John Doe",
            "assignee_email": "john@test.com",
            "employee_id": "EMP001",
            "assignment_date": "2024-01-01",
        },
        headers=headers,
    )
    assert resp.status_code == 201, f"Assignment creation failed: {resp.text}"
    return resp.json()["id"]


class TestAssignmentUpdateSecurity:
    def test_extra_fields_in_patch_rejected(self, client, admin_auth):
        """extra='forbid' must reject unknown fields — prevents mass-assignment."""
        asset_id = _create_asset(client, admin_auth)
        assignment_id = _create_assignment(client, admin_auth, asset_id)

        resp = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={
                "notes": "Legitimate update",
                "is_active": False,        # should be rejected
                "approval_status": "rejected",  # should be rejected
                "asset_id": str(uuid.uuid4()),  # should be rejected
            },
            headers=admin_auth,
        )
        assert resp.status_code == 422

    def test_patch_valid_fields_succeed(self, client, admin_auth):
        asset_id = _create_asset(client, admin_auth)
        assignment_id = _create_assignment(client, admin_auth, asset_id)

        resp = client.patch(
            f"/api/v1/assignments/{assignment_id}",
            json={"notes": "Updated note", "department": "Engineering"},
            headers=admin_auth,
        )
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Updated note"

    def test_patch_requires_manager_or_admin(self, client, user_auth):
        resp = client.patch(
            f"/api/v1/assignments/{uuid.uuid4()}",
            json={"notes": "Trying to update"},
            headers=user_auth,
        )
        assert resp.status_code == 403


class TestBulkReturnSecurity:
    def test_bulk_return_wrong_payload_shape_rejected(self, client, admin_auth):
        """extra='forbid' model must reject unknown keys."""
        resp = client.post(
            "/api/v1/assignments/bulk-return",
            json={
                "assignment_ids": [],
                "force": True,          # unknown field
                "bypass_check": True,   # unknown field
            },
            headers=admin_auth,
        )
        assert resp.status_code == 422

    def test_bulk_return_empty_list_succeeds(self, client, admin_auth):
        resp = client.post(
            "/api/v1/assignments/bulk-return",
            json={"assignment_ids": []},
            headers=admin_auth,
        )
        assert resp.status_code == 200
        assert resp.json()["returned"] == 0

    def test_bulk_return_invalid_uuid_handled_gracefully(self, client, admin_auth):
        resp = client.post(
            "/api/v1/assignments/bulk-return",
            json={"assignment_ids": ["not-a-uuid", "also-bad"]},
            headers=admin_auth,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["returned"] == 0
        assert data["failed"] == 2


class TestClearanceEmailSecurity:
    def test_invalid_employee_email_rejected(self, client, admin_auth):
        """EmailStr validation must reject malformed addresses."""
        with patch("app.api.v1.endpoints.assignments.send_email", return_value=True):
            resp = client.post(
                "/api/v1/assignments/send-clearance-email",
                json={
                    "employee_name": "John Doe",
                    "employee_email": "not-an-email",
                    "current_assets": [],
                    "history_assets": [],
                },
                headers=admin_auth,
            )
        assert resp.status_code == 422

    def test_invalid_manager_email_rejected(self, client, admin_auth):
        with patch("app.api.v1.endpoints.assignments.send_email", return_value=True):
            resp = client.post(
                "/api/v1/assignments/send-clearance-email",
                json={
                    "employee_name": "John Doe",
                    "manager_emails": ["valid@test.com", "bad-email"],
                    "current_assets": [],
                    "history_assets": [],
                },
                headers=admin_auth,
            )
        assert resp.status_code == 422

    def test_no_recipients_rejected(self, client, admin_auth):
        with patch("app.api.v1.endpoints.assignments.send_email", return_value=True):
            resp = client.post(
                "/api/v1/assignments/send-clearance-email",
                json={
                    "employee_name": "John Doe",
                    "current_assets": [],
                    "history_assets": [],
                },
                headers=admin_auth,
            )
        assert resp.status_code == 422

    def test_extra_fields_rejected(self, client, admin_auth):
        with patch("app.api.v1.endpoints.assignments.send_email", return_value=True):
            resp = client.post(
                "/api/v1/assignments/send-clearance-email",
                json={
                    "employee_name": "John Doe",
                    "employee_email": "john@test.com",
                    "current_assets": [],
                    "history_assets": [],
                    "internal_flag": True,  # extra field
                },
                headers=admin_auth,
            )
        assert resp.status_code == 422

    def test_valid_request_triggers_email(self, client, admin_auth):
        with patch("app.api.v1.endpoints.assignments.send_email", return_value=True) as mock:
            resp = client.post(
                "/api/v1/assignments/send-clearance-email",
                json={
                    "employee_name": "John Doe",
                    "employee_email": "john@test.com",
                    "manager_emails": ["mgr@test.com"],
                    "current_assets": [],
                    "history_assets": [],
                },
                headers=admin_auth,
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "john@test.com" in data["sent"]
        assert "mgr@test.com" in data["sent"]
        assert mock.call_count == 2

    def test_requires_manager_or_admin(self, client, user_auth):
        resp = client.post(
            "/api/v1/assignments/send-clearance-email",
            json={
                "employee_name": "John",
                "employee_email": "john@test.com",
                "current_assets": [],
                "history_assets": [],
            },
            headers=user_auth,
        )
        assert resp.status_code == 403
