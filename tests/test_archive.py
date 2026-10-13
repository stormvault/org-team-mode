"""Unit tests for archive management and Zip-Slip defense."""

import io
import json
import zipfile
from pathlib import Path
import pytest

from emacs_jail.archive import UserArchiveManager, validate_uid
from emacs_jail.config import JailConfig
from emacs_jail.exceptions import (
    FileNotFoundInEnvironmentError,
    InvalidUserIdError,
    LockTimeoutError,
    ZipSlipSecurityError,
)


def test_validate_uid():
    assert validate_uid("user_101") == "user_101"
    assert validate_uid("tenant-alpha.v2") == "tenant-alpha.v2"
    assert validate_uid(42) == "42"

    with pytest.raises(InvalidUserIdError):
        validate_uid("..")

    with pytest.raises(InvalidUserIdError):
        validate_uid("foo/bar")

    with pytest.raises(InvalidUserIdError):
        validate_uid("../etc/passwd")

    with pytest.raises(InvalidUserIdError):
        validate_uid("")

    with pytest.raises(InvalidUserIdError):
        validate_uid("user;rm -rf /")


def test_initial_archive_creation(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")
    mgr = UserArchiveManager(cfg)

    archive = mgr.create_initial_archive("user_test")
    assert archive.is_file()
    assert archive.name == "user_test.zip"

    files = [f["filename"] for f in mgr.list_files("user_test")]
    assert ".jail_metadata.json" in files
    assert ".emacs.d/init.el" in files
    assert "workspace/notes.org" in files

    meta = mgr.get_metadata("user_test")
    assert meta["uid"] == "user_test"


def test_zip_slip_security_prevention(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")
    mgr = UserArchiveManager(cfg)

    # Manually craft a malicious zip containing path traversal
    archive_path = mgr.get_archive_path("malicious_user")
    with zipfile.ZipFile(archive_path, "w") as zf:
        zf.writestr("../../etc/evil.txt", "pwned")

    target_dir = tmp_path / "extract_dest"
    with pytest.raises(ZipSlipSecurityError):
        mgr.extract_archive("malicious_user", target_dir)


def test_direct_file_rw_and_deletion(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")
    mgr = UserArchiveManager(cfg)

    uid = "rw_user"
    mgr.create_initial_archive(uid)

    mgr.write_file(uid, "workspace/custom.txt", "Sample payload")
    read_data = mgr.read_file(uid, "workspace/custom.txt")
    assert read_data.decode("utf-8") == "Sample payload"

    mgr.delete_file(uid, "workspace/custom.txt")
    with pytest.raises(FileNotFoundInEnvironmentError):
        mgr.read_file(uid, "workspace/custom.txt")
