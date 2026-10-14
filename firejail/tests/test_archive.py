"""Unit tests for archive management and Zip-Slip defense."""

import zipfile

import pytest

from emacs_jail.archive import UserArchiveManager, validate_uid
from emacs_jail.config import JailConfig
from emacs_jail.exceptions import (
    FileNotFoundInEnvironmentError,
    InvalidUserIdError,
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


def test_repack_preserves_packaged_binaries(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")
    mgr = UserArchiveManager(cfg)

    uid = "binary_tenant"
    mgr.create_initial_archive(
        uid,
        extra_files={".emacs_jail/bin/emacs": b"#!/bin/sh\necho static-emacs\n"},
    )

    # Initial check
    initial_files = [f["filename"] for f in mgr.list_files(uid)]
    assert ".emacs_jail/bin/emacs" in initial_files

    # Unpack and repack into target directory
    extract_dir = tmp_path / "extracted_session"
    mgr.extract_archive(uid, extract_dir)

    # Ensure executable permission
    bin_path = extract_dir / ".emacs_jail" / "bin" / "emacs"
    assert bin_path.exists()
    bin_path.chmod(0o755)

    # Repack
    mgr.repack_archive(uid, extract_dir)

    # Verify preserved
    repacked_files = [f["filename"] for f in mgr.list_files(uid)]
    assert ".emacs_jail/bin/emacs" in repacked_files

    # Extract again to verify permissions preserved
    re_extract = tmp_path / "re_extracted"
    mgr.extract_archive(uid, re_extract)
    re_bin = re_extract / ".emacs_jail" / "bin" / "emacs"
    assert re_bin.exists()
    assert (re_bin.stat().st_mode & 0o111) != 0


def test_setup_org_mode_in_profile_archive(tmp_path):
    cfg = JailConfig(storage_dir=tmp_path / "storage", runtime_base_dir=tmp_path / "run")
    mgr = UserArchiveManager(cfg)

    uid = "test_user_org"
    archive = mgr.create_initial_archive(uid)
    assert archive.is_file()

    files = [f["filename"] for f in mgr.list_files(uid)]
    assert ".emacs_jail/lisp/setup-org-mode.el" in files
    assert "lisp/setup-org-mode.el" in files
    assert "setup-org-mode.el" in files

    content = mgr.read_file(uid, ".emacs_jail/lisp/setup-org-mode.el").decode("utf-8")
    assert "setup-org-mode" in content
    assert "org-mode-setup.el" in content


