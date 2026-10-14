"""Unit tests for UserEnvironment lifecycle and workspace management."""


import pytest
from emacs_jail.config import JailConfig
from emacs_jail.exceptions import FileNotFoundInEnvironmentError, ZipSlipSecurityError
from emacs_jail.user_env import UserEnvironment


def test_user_environment_lifecycle(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")

    uid = "env_user"
    with UserEnvironment(uid, config=cfg) as env:
        assert env.runtime_dir.exists()
        assert env.workspace_dir.exists()

        # Write workspace file
        env.write_workspace_file("test.txt", "Active session write")
        resolved = env.resolve_path("test.txt", must_exist=True)
        assert resolved.exists()

        content = env.read_workspace_file("test.txt")
        assert content == b"Active session write"

    # After exit, runtime directory should be cleaned up
    assert not env.runtime_dir.exists()

    # The file should be saved in the archive
    with UserEnvironment(uid, config=cfg) as env2:
        content2 = env2.read_workspace_file("test.txt")
        assert content2 == b"Active session write"


def test_resolve_path_security(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")

    with UserEnvironment("sec_user", config=cfg) as env:
        with pytest.raises(ZipSlipSecurityError):
            env.resolve_path("../../../../../etc/passwd")

        with pytest.raises(FileNotFoundInEnvironmentError):
            env.resolve_path("non_existent_file.org", must_exist=True)
