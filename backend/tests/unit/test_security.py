"""Unit tests for JWT and password security functions."""

import pytest
import time
from datetime import timedelta

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    create_password_reset_token,
    decode_token,
)


class TestPasswordHashing:
    def test_hash_is_not_plain_text(self):
        hashed = get_password_hash("MySecret1")
        assert hashed != "MySecret1"

    def test_correct_password_verifies(self):
        hashed = get_password_hash("CorrectHorse1")
        assert verify_password("CorrectHorse1", hashed) is True

    def test_wrong_password_rejected(self):
        hashed = get_password_hash("CorrectHorse1")
        assert verify_password("WrongHorse1", hashed) is False

    def test_empty_password_rejected_against_real_hash(self):
        hashed = get_password_hash("SomePass1")
        assert verify_password("", hashed) is False

    def test_hash_is_different_each_time(self):
        """bcrypt uses random salt — two hashes of same plaintext differ."""
        h1 = get_password_hash("SamePass1")
        h2 = get_password_hash("SamePass1")
        assert h1 != h2


class TestJWTTokens:
    def test_access_token_decode_returns_sub(self):
        token = create_access_token({"sub": "user-123", "role": "admin"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_refresh_token_has_correct_type(self):
        token = create_refresh_token({"sub": "user-456"})
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-456"

    def test_password_reset_token_has_correct_type(self):
        token = create_password_reset_token("user-789")
        payload = decode_token(token)
        assert payload is not None
        assert payload["type"] == "password_reset"
        assert payload["sub"] == "user-789"

    def test_tampered_token_rejected(self):
        token = create_access_token({"sub": "user-123"})
        # Flip a character in the signature part
        tampered = token[:-5] + ("X" * 5)
        assert decode_token(tampered) is None

    def test_expired_token_rejected(self):
        token = create_access_token(
            {"sub": "user-123"}, expires_delta=timedelta(seconds=-1)
        )
        assert decode_token(token) is None

    def test_malformed_token_rejected(self):
        assert decode_token("not.a.token") is None
        assert decode_token("") is None
        assert decode_token("eyJhbGciOiJIUzI1NiJ9.bad.sig") is None

    def test_access_token_cannot_be_used_as_refresh(self):
        """Type checking prevents token type confusion attacks."""
        token = create_access_token({"sub": "user-123"})
        payload = decode_token(token)
        assert payload["type"] != "refresh"
