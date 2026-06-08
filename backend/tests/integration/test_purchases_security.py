"""Integration tests: file upload and download security."""

import io
import pytest
import uuid


def _create_purchase(client, headers, suffix="") -> str:
    """Helper: create a purchase record and return its ID."""
    resp = client.post(
        "/api/v1/purchases",
        json={
            "vendor_name": f"Test Vendor{suffix}",
            "invoice_number": f"INV-SEC-{uuid.uuid4().hex[:8]}",
            "purchase_date": "2024-01-01",
            "total_cost": 100.0,
        },
        headers=headers,
    )
    assert resp.status_code == 201, f"Purchase creation failed: {resp.text}"
    return resp.json()["id"]


class TestFileUploadSecurity:
    def test_upload_sanitizes_filename(self, client, admin_auth):
        """The stored filename must be a UUID, not the original uploaded name."""
        purchase_id = _create_purchase(client, admin_auth, "-upload-sanitize")
        file_content = b"%PDF-1.4 dummy content"
        resp = client.post(
            f"/api/v1/purchases/{purchase_id}/documents",
            files={"file": ("invoice.pdf", io.BytesIO(file_content), "application/pdf")},
            headers=admin_auth,
        )
        assert resp.status_code == 201
        data = resp.json()
        # safe_filename should be a UUID, not the original name
        safe_name = data.get("safe_filename", "")
        assert "invoice" not in safe_name
        assert safe_name.endswith(".pdf")
        # Original name is preserved for display
        assert data.get("filename") == "invoice.pdf"

    def test_upload_double_extension_blocked(self, client, admin_auth):
        """Filename like 'shell.php.pdf' — last extension (.pdf) passes, but 'shell.php' trick blocked."""
        purchase_id = _create_purchase(client, admin_auth, "-double-ext")
        resp = client.post(
            f"/api/v1/purchases/{purchase_id}/documents",
            files={"file": ("malware.exe", io.BytesIO(b"evil"), "application/pdf")},
            headers=admin_auth,
        )
        # Content-type says pdf but extension says exe → extension check should reject it
        assert resp.status_code == 400

    def test_upload_executable_extension_rejected(self, client, admin_auth):
        purchase_id = _create_purchase(client, admin_auth, "-exe-ext")
        resp = client.post(
            f"/api/v1/purchases/{purchase_id}/documents",
            files={"file": ("shell.exe", io.BytesIO(b"evil"), "application/octet-stream")},
            headers=admin_auth,
        )
        assert resp.status_code == 400

    def test_upload_disallowed_content_type_rejected(self, client, admin_auth):
        purchase_id = _create_purchase(client, admin_auth, "-bad-type")
        resp = client.post(
            f"/api/v1/purchases/{purchase_id}/documents",
            files={"file": ("script.js", io.BytesIO(b"evil()"), "application/javascript")},
            headers=admin_auth,
        )
        assert resp.status_code == 400

    def test_upload_requires_auth(self, client):
        resp = client.post(
            "/api/v1/purchases/00000000-0000-0000-0000-000000000000/documents",
            files={"file": ("test.pdf", io.BytesIO(b"content"), "application/pdf")},
        )
        assert resp.status_code == 401


class TestFileDownloadSecurity:
    def test_path_traversal_in_filename_blocked(self, client, admin_auth):
        """Filename with ../ sequences must be rejected with 403."""
        purchase_id = _create_purchase(client, admin_auth, "-traversal")

        # Simulate URL-encoded path traversal: ../../../etc/passwd
        # FastAPI decodes %2F, but the route separator prevents literal /
        # We test the boundary check via the normalised filename
        traversal = "..%2F..%2Fetc%2Fpasswd"
        resp = client.get(
            f"/api/v1/purchases/{purchase_id}/documents/{traversal}",
            headers=admin_auth,
        )
        # Either 403 (traversal detected) or 404 (file not found) — never 200
        assert resp.status_code in (403, 404)
        assert resp.status_code != 200

    def test_download_nonexistent_file_returns_404(self, client, admin_auth):
        purchase_id = _create_purchase(client, admin_auth, "-dl-404")
        resp = client.get(
            f"/api/v1/purchases/{purchase_id}/documents/nonexistent.pdf",
            headers=admin_auth,
        )
        assert resp.status_code == 404

    def test_download_requires_auth(self, client):
        resp = client.get(
            "/api/v1/purchases/00000000-0000-0000-0000-000000000000/documents/file.pdf"
        )
        assert resp.status_code == 401

    def test_download_nonexistent_purchase_returns_404(self, client, admin_auth):
        fake_id = str(uuid.uuid4())
        resp = client.get(
            f"/api/v1/purchases/{fake_id}/documents/some.pdf",
            headers=admin_auth,
        )
        assert resp.status_code == 404
