"""Environment-backed application configuration."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    gemini_api_key: SecretStr | None = None
    # Stable, multimodal Flash-Lite model selected for high-frequency free-tier use.
    # Keep this overrideable so a billing-enabled deployment can choose differently.
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_timeout_seconds: float = Field(default=60.0, ge=5.0, le=180.0)
    gemini_max_attempts: int = Field(default=3, ge=1, le=5)
    max_upload_bytes: int = Field(default=10 * 1024 * 1024, ge=1 * 1024 * 1024)


@lru_cache
def get_settings() -> Settings:
    return Settings()
