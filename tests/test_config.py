"""Tests for emacs_web configuration and package wiring."""

import os
from pathlib import Path
from unittest import mock

from emacs_web.config import Settings, get_settings


def test_default_settings() -> None:
    """Verify default settings values when no environment overrides exist."""
    settings = Settings()
    assert settings.emacs_agent_persistence == "EPHEMERAL"
    assert settings.test_auth_override is False
    assert isinstance(settings.emacs_jail_storage_dir, Path)
    assert settings.emacs_jail_storage_dir.name == "users"


def test_settings_environment_override() -> None:
    """Verify settings can be overridden via environment variables."""
    with mock.patch.dict(
        os.environ,
        {
            "EMACS_AGENT_PERSISTENCE": "LONGRUNNING",
            "TEST_AUTH_OVERRIDE": "true",
            "EMACS_JAIL_STORAGE_DIR": "/tmp/custom_users",
        },
    ):
        settings = Settings()
        assert settings.emacs_agent_persistence == "LONGRUNNING"
        assert settings.test_auth_override is True
        assert settings.emacs_jail_storage_dir == Path("/tmp/custom_users")


def test_get_settings_cached() -> None:
    """Verify get_settings returns consistent cached Settings singleton."""
    s1 = get_settings()
    s2 = get_settings()
    assert s1 is s2


def test_emacs_jail_package_import() -> None:
    """Verify clean import of emacs_jail components and agent tools."""
    from emacs_jail import (
        EmacsOrgManager,
        JailConfig,
        UserArchiveManager,
        UserEnvironment,
    )
    from emacs_jail.agent_tools import ANTIGRAVITY_TOOLS

    assert UserArchiveManager is not None
    assert EmacsOrgManager is not None
    assert JailConfig is not None
    assert UserEnvironment is not None
    assert len(ANTIGRAVITY_TOOLS) > 0


def test_main_cli_entrypoint() -> None:
    """Verify main CLI entrypoint parses args and calls uvicorn.run."""
    import sys

    from emacs_web.app import main

    with (
        mock.patch.object(
            sys, "argv", ["emacs-web", "--port", "9090", "--host", "127.0.0.1"]
        ),
        mock.patch("uvicorn.run") as mock_uvicorn_run,
    ):
        main()
        mock_uvicorn_run.assert_called_once_with(
            "emacs_web.app:app", host="127.0.0.1", port=9090, reload=False
        )
