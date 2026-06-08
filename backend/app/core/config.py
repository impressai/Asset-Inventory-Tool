"""
Application configuration — reads from environment variables / .env file.
"""

import json
from typing import Any, List, Type
from pydantic.fields import FieldInfo
from pydantic_settings import BaseSettings, EnvSettingsSource


class _SafeEnvSource(EnvSettingsSource):
    """Handles empty or comma-separated env vars for List[str] fields.

    pydantic-settings calls json.loads() on complex fields before any
    field_validator runs, so an empty string crashes at import time.
    This source returns None for empty strings (field default takes over)
    and converts comma-separated values to a JSON array before handing
    off to the normal parser.
    """

    def prepare_field_value(
        self, field_name: str, field: FieldInfo, value: Any, value_is_complex: bool
    ) -> Any:
        if value_is_complex and isinstance(value, str):
            v = value.strip()
            if not v:
                return None
            if not v.startswith(("[", "{")):
                return json.dumps([p.strip() for p in v.split(",") if p.strip()])
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = "AssetInventory"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"          # development | staging | production

    # ── API Security ─────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "asset_inventory"
    POSTGRES_USER: str = "asset_user"
    POSTGRES_PASSWORD: str

    # ── CORS ──────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:80",
    ]
    ALLOWED_HOSTS: List[str] = ["*"]

    # ── AWS ───────────────────────────────────────────────────
    AWS_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_DOCUMENTS: str = "asset-inventory-documents"

    # ── Email ─────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAILS_FROM_EMAIL: str = "noreply@asset-inventory.com"
    EMAILS_FROM_NAME: str = "Asset Inventory"
    FRONTEND_URL: str = "http://localhost:3000"
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 60

    # ── File Upload ───────────────────────────────────────────
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_TYPES: List[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
    LOCAL_UPLOAD_DIR: str = "/app/uploads"

    # ── Pagination ────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: Type[BaseSettings],
        init_settings=None,
        env_settings=None,
        dotenv_settings=None,
        secrets_settings=None,
        file_secret_settings=None,
        **kwargs,
    ):
        extra = file_secret_settings or secrets_settings
        return tuple(
            s for s in [init_settings, _SafeEnvSource(settings_cls), dotenv_settings, extra]
            if s is not None
        )

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
