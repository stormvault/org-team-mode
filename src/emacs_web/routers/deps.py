"""Shared dependencies for FastAPI router endpoints."""

from typing import Annotated

from emacs_jail.archive import UserArchiveManager
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager
from fastapi import Depends

from emacs_web.config import Settings, get_settings


def get_jail_config(
    settings: Annotated[Settings, Depends(get_settings)],
) -> JailConfig:
    """Construct JailConfig mapped from application Settings.

    Args:
        settings: Application settings.

    Returns:
        JailConfig: Configured jail configuration.
    """
    return JailConfig(storage_dir=settings.emacs_jail_storage_dir)


def get_archive_manager(
    config: Annotated[JailConfig, Depends(get_jail_config)],
) -> UserArchiveManager:
    """Provide UserArchiveManager dependency.

    Args:
        config: Jail configuration.

    Returns:
        UserArchiveManager: Archive manager instance.
    """
    return UserArchiveManager(config)


def get_org_manager(
    config: Annotated[JailConfig, Depends(get_jail_config)],
) -> EmacsOrgManager:
    """Provide EmacsOrgManager dependency.

    Args:
        config: Jail configuration.

    Returns:
        EmacsOrgManager: Org manager instance.
    """
    return EmacsOrgManager(config)
