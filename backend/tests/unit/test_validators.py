"""Unit tests for password strength validator."""

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.auth import _validate_password_strength


class TestPasswordStrengthValidator:
    def test_strong_password_passes(self):
        """A well-formed password raises no exception."""
        _validate_password_strength("SecurePass1")  # should not raise

    def test_minimum_length_passes(self):
        """Exactly 8 chars with mixed case + digit passes."""
        _validate_password_strength("Abcdef1!")  # 8 chars

    def test_too_short_raises(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password_strength("Ab1")
        assert exc.value.status_code == 400
        assert "8 characters" in exc.value.detail

    def test_no_uppercase_raises(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password_strength("alllower1")
        assert exc.value.status_code == 400
        assert "uppercase" in exc.value.detail.lower()

    def test_no_lowercase_raises(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password_strength("ALLUPPER1")
        assert exc.value.status_code == 400
        assert "lowercase" in exc.value.detail.lower()

    def test_no_digit_raises(self):
        with pytest.raises(HTTPException) as exc:
            _validate_password_strength("NoDigitPass")
        assert exc.value.status_code == 400
        assert "digit" in exc.value.detail.lower()

    def test_all_missing_raises_length_first(self):
        """Short + no-uppercase → length error takes precedence."""
        with pytest.raises(HTTPException) as exc:
            _validate_password_strength("ab")
        assert exc.value.status_code == 400
        assert "8 characters" in exc.value.detail

    @pytest.mark.parametrize("pw", [
        "GoodPass1",
        "Another$ecure8",
        "Str0ng_Pass!",
        "12345678Aa",
    ])
    def test_valid_passwords_pass(self, pw):
        _validate_password_strength(pw)  # should not raise
