"""Application configuration settings for the emacs-web gateway."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration settings loaded from environment or defaults."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    emacs_agent_persistence: str = "EPHEMERAL"
    emacs_jail_storage_dir: Path = (
        Path(__file__).resolve().parent.parent.parent / "data" / "users"
    )
    test_auth_override: bool = False
    firebase_credentials_path: str | None = None
    firebase_project_id: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton.

    Returns:
        Settings: Application configuration settings.
    """
    return Settings()
