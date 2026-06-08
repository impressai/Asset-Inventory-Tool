"""Integration tests: authentication endpoints security."""

import pytest
from unittest.mock import patch


class TestLogin:
    def test_valid_credentials_return_tokens(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@test.com", "password": "AdminPass1"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_wrong_password_returns_401(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@test.com", "password": "WrongPass999"},
        )
        assert resp.status_code == 401

    def test_nonexistent_user_returns_401(self, client):
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": "nobody@test.com", "password": "SomePass1"},
        )
        assert resp.status_code == 401

    def test_error_message_is_generic(self, client):
        """Must not reveal whether email or password was wrong (no user enumeration)."""
        resp = client.post(
            "/api/v1/auth/login",
            data={"username": "nobody@test.com", "password": "SomePass1"},
        )
        detail = resp.json().get("detail", "")
        assert "Incorrect" not in detail
        assert "email" not in detail.lower() or "password" not in detail.lower()
        assert "Invalid credentials" in detail or "credentials" in detail.lower()

    def test_inactive_user_rejected(self, client, _create_schema):
        from tests.integration.conftest import _Session
        from app.models.models import User, UserRole
        from app.core.security import get_password_hash

        session = _Session()
        try:
            user = User(
                full_name="Inactive User",
                email="inactive@test.com",
                hashed_password=get_password_hash("InactivePass1"),
                role=UserRole.USER,
                is_active=False,
            )
            session.add(user)
            session.commit()
        finally:
            session.close()

        resp = client.post(
            "/api/v1/auth/login",
            data={"username": "inactive@test.com", "password": "InactivePass1"},
        )
        assert resp.status_code == 401


class TestRefreshToken:
    def test_valid_refresh_returns_new_tokens(self, client):
        login = client.post(
            "/api/v1/auth/login",
            data={"username": "admin@test.com", "password": "AdminPass1"},
        )
        refresh = login.json()["refresh_token"]
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    def test_access_token_cannot_be_used_as_refresh(self, client, admin_token):
        """Token type confusion attack: access token must be rejected as refresh."""
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": admin_token})
        assert resp.status_code == 401

    def test_invalid_refresh_token_rejected(self, client):
        resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.token"})
        assert resp.status_code == 401


class TestForgotPassword:
    def test_always_returns_200_for_any_email(self, client):
        """Prevent user enumeration — same response whether email exists or not."""
        with patch("app.api.v1.endpoints.auth.send_email", return_value=True):
            resp_existing = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "admin@test.com"},
            )
            resp_missing = client.post(
                "/api/v1/auth/forgot-password",
                json={"email": "no-such-user@test.com"},
            )
        assert resp_existing.status_code == 200
        assert resp_missing.status_code == 200
        # Responses must look identical
        assert resp_existing.json() == resp_missing.json()

    def test_invalid_email_format_rejected(self, client):
        resp = client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert resp.status_code == 422


class TestResetPassword:
    def test_weak_password_rejected(self, client):
        from app.core.security import create_password_reset_token
        from tests.integration.conftest import _Session
        from app.models.models import User

        session = _Session()
        try:
            user = session.query(User).filter(User.email == "admin@test.com").first()
            token = create_password_reset_token(str(user.id))
        finally:
            session.close()

        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "short"},
        )
        assert resp.status_code == 400
        assert "8 characters" in resp.json()["detail"]

    def test_no_uppercase_rejected(self, client):
        from app.core.security import create_password_reset_token
        from tests.integration.conftest import _Session
        from app.models.models import User

        session = _Session()
        try:
            user = session.query(User).filter(User.email == "admin@test.com").first()
            token = create_password_reset_token(str(user.id))
        finally:
            session.close()

        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "alllower1"},
        )
        assert resp.status_code == 400

    def test_invalid_token_rejected(self, client):
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "fake.token.here", "new_password": "NewSecure1"},
        )
        assert resp.status_code == 400
