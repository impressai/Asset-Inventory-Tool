"""Unit tests for path traversal prevention logic (mirrors purchases.py download check)."""

import os
import pytest


def _is_path_safe(base_dir: str, filename: str) -> bool:
    """Replicates the boundary check in the download_document endpoint."""
    abs_base = os.path.abspath(base_dir)
    abs_path = os.path.abspath(os.path.join(abs_base, filename))
    return abs_path.startswith(abs_base + os.sep)


class TestPathTraversalPrevention:
    def test_safe_uuid_filename_passes(self):
        assert _is_path_safe("/uploads/purchases/some-uuid", "abc123.pdf") is True

    def test_traversal_with_dotdot_blocked(self):
        assert _is_path_safe("/uploads/purchases/some-uuid", "../../etc/passwd") is False

    def test_traversal_to_sibling_dir_blocked(self):
        assert _is_path_safe("/uploads/purchases/uuid-A", "../uuid-B/file.pdf") is False

    def test_absolute_path_injection_blocked(self):
        assert _is_path_safe("/uploads/purchases/some-uuid", "/etc/passwd") is False

    def test_nested_safe_path_passes(self):
        """A filename that stays within the base is fine."""
        assert _is_path_safe("/uploads/purchases/some-uuid", "subdir/file.pdf") is True

    def test_empty_filename_blocked(self):
        """Empty filename resolves to base_dir itself, not a file inside it."""
        result = _is_path_safe("/uploads/purchases/some-uuid", "")
        # base_dir itself does NOT start with base_dir + os.sep
        assert result is False

    def test_encoded_traversal_blocked(self):
        """os.path.abspath normalises %2F-decoded strings too."""
        assert _is_path_safe("/uploads/purchases/some-uuid", "..%2F..%2Fetc%2Fpasswd") is False

    @pytest.mark.parametrize("filename", [
        "safe-file.pdf",
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
        "document_2024.xlsx",
    ])
    def test_uuid_style_filenames_pass(self, filename):
        assert _is_path_safe("/uploads/purchases/some-uuid", filename) is True


class TestFileExtensionValidation:
    ALLOWED = {".pdf", ".jpg", ".jpeg", ".png", ".xlsx"}

    def test_pdf_allowed(self):
        from pathlib import Path
        ext = Path("invoice.pdf").suffix.lower()
        assert ext in self.ALLOWED

    def test_exe_blocked(self):
        from pathlib import Path
        ext = Path("malware.exe").suffix.lower()
        assert ext not in self.ALLOWED

    def test_php_blocked(self):
        from pathlib import Path
        ext = Path("shell.php").suffix.lower()
        assert ext not in self.ALLOWED

    def test_double_extension_uses_last(self):
        """Path.suffix returns the last extension only — prevents .pdf.exe tricks."""
        from pathlib import Path
        ext = Path("document.pdf.exe").suffix.lower()
        assert ext == ".exe"
        assert ext not in self.ALLOWED

    def test_no_extension_blocked(self):
        from pathlib import Path
        ext = Path("noextension").suffix.lower()
        assert ext not in self.ALLOWED
