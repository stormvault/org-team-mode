"""Single-file ZIP archived environment management for virtual User IDs (UIDs).

Provides multi-tenant persistence, atomic writes, zip-slip defense, and file locking.
"""

import fcntl
import io
import json
import os
import re
import shutil
import time
import uuid
import zipfile
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Union

from emacs_jail.config import JailConfig
from emacs_jail.exceptions import (
    ArchiveError,
    FileNotFoundInEnvironmentError,
    InvalidUserIdError,
    LockTimeoutError,
    ZipSlipSecurityError,
)

# Strict UID pattern: alphanumeric characters, underscores, hyphens, dots.
# Must NOT be empty, contain slashes, null bytes, or start with dot.
UID_REGEX = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]{0,127}$")


def validate_uid(uid: Union[str, int]) -> str:
    """Validate and sanitize a non-system virtual user ID.

    Args:
        uid: User identifier (string or integer).

    Returns:
        Validated string UID.

    Raises:
        InvalidUserIdError: If the UID contains illegal characters or path traversal.
    """
    uid_str = str(uid).strip()
    if not uid_str:
        raise InvalidUserIdError("User ID cannot be empty.")
    if uid_str in (".", "..") or "/" in uid_str or "\\" in uid_str or "\0" in uid_str:
        raise InvalidUserIdError(f"User ID contains dangerous characters or traversal elements: {uid!r}")
    if not UID_REGEX.match(uid_str):
        raise InvalidUserIdError(
            f"User ID '{uid_str}' contains invalid characters. Must match {UID_REGEX.pattern}"
        )
    return uid_str


import threading

_active_locks: Dict[str, Dict[str, Any]] = {}
_locks_mutex = threading.Lock()


class ArchiveLock:
    """Multi-process, re-entrant file lock for a virtual user archive using fcntl.flock."""

    def __init__(self, lock_file: Path, timeout: float = 20.0):
        self.lock_file = Path(lock_file).resolve()
        self.timeout = timeout
        self._canonical_key = str(self.lock_file)

    def acquire(self) -> None:
        """Acquire an exclusive lock with timeout polling, supporting re-entrancy."""
        thread_id = threading.get_ident()

        with _locks_mutex:
            lock_info = _active_locks.get(self._canonical_key)
            if lock_info is not None and lock_info["thread_id"] == thread_id:
                # Re-entrant acquisition by the same thread
                lock_info["depth"] += 1
                return

        self.lock_file.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(self.lock_file), os.O_CREAT | os.O_RDWR, 0o600)
        start_time = time.monotonic()
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                with _locks_mutex:
                    _active_locks[self._canonical_key] = {
                        "fd": fd,
                        "depth": 1,
                        "thread_id": thread_id,
                    }
                return
            except (BlockingIOError, OSError):
                if time.monotonic() - start_time >= self.timeout:
                    try:
                        os.close(fd)
                    except OSError:
                        pass
                    raise LockTimeoutError(
                        f"Timed out after {self.timeout}s waiting for environment lock: {self.lock_file}"
                    )
                time.sleep(0.05)

    def release(self) -> None:
        """Release the file lock when recursion depth reaches zero."""
        thread_id = threading.get_ident()

        with _locks_mutex:
            lock_info = _active_locks.get(self._canonical_key)
            if lock_info is None or lock_info["thread_id"] != thread_id:
                return

            lock_info["depth"] -= 1
            if lock_info["depth"] > 0:
                return

            fd = lock_info["fd"]
            del _active_locks[self._canonical_key]

        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass
        try:
            os.close(fd)
        except OSError:
            pass

    def __enter__(self) -> "ArchiveLock":
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.release()


class UserArchiveManager:
    """Manages long-lasting single-file ZIP archives for non-system UIDs."""

    def __init__(self, config: Optional[JailConfig] = None):
        self.config = config or JailConfig()

    def get_archive_path(self, uid: Union[str, int]) -> Path:
        """Get absolute path to user's .zip archive."""
        clean_uid = validate_uid(uid)
        return self.config.storage_dir / f"{clean_uid}.zip"

    def get_lock_path(self, uid: Union[str, int]) -> Path:
        """Get absolute path to user's lock file."""
        clean_uid = validate_uid(uid)
        return self.config.storage_dir / f"{clean_uid}.lock"

    def archive_exists(self, uid: Union[str, int]) -> bool:
        """Check if user archive exists."""
        return self.get_archive_path(uid).is_file()

    @contextmanager
    def lock(self, uid: Union[str, int]) -> Generator[ArchiveLock, None, None]:
        """Context manager to hold an exclusive lock on a user's environment."""
        lock_obj = ArchiveLock(self.get_lock_path(uid), timeout=self.config.lock_timeout_seconds)
        with lock_obj:
            yield lock_obj

    def create_initial_archive(self, uid: Union[str, int], extra_files: Optional[Dict[str, Union[str, bytes]]] = None) -> Path:
        """Create a default starter archive for a new user UID.

        Layout inside ZIP:
          .emacs.d/init.el
          workspace/notes.org
          .jail_metadata.json
        """
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)

        with self.lock(clean_uid):
            if archive_path.is_file():
                return archive_path

            tmp_archive = archive_path.with_suffix(f".tmp.{os.getpid()}_{uuid.uuid4().hex[:8]}")
            now = datetime.now(timezone.utc).isoformat()

            metadata = {
                "uid": clean_uid,
                "created_at": now,
                "updated_at": now,
                "version": "1.0.0",
                "emacs_jail_version": "1.0.0",
                "description": f"Emacs-Jail environment for non-system user {clean_uid}",
            }

            default_init_el = (
                ";;; init.el --- Emacs-Jail User Initialization -*- lexical-binding: t; -*-\n"
                "(set-language-environment \"UTF-8\")\n"
                "(prefer-coding-system 'utf-8)\n"
                "(setq inhibit-startup-screen t\n"
                "      make-backup-files nil\n"
                "      auto-save-default nil\n"
                "      create-lockfiles nil)\n"
                "(require 'org)\n"
                "(setq org-export-with-toc t\n"
                "      org-export-with-section-numbers t)\n"
            )

            default_notes_org = (
                f"#+TITLE: Workspace Notes\n"
                f"#+AUTHOR: User {clean_uid}\n"
                f"#+DATE: {now}\n\n"
                f"* Welcome to Emacs-Jail\n"
                f"Your environment is sandboxed using Firejail and persisted in a single-file zip archive.\n\n"
                f"** Tasks\n"
                f"*** TODO Review isolated org-mode capabilities\n"
                f"SCHEDULED: <{datetime.now().strftime('%Y-%m-%d %a')}>\n"
                f"*** TODO Test Org-Babel execution\n\n"
                f"** Python Babel Block Example\n"
                f"#+begin_src python :results output\n"
                f"print('Hello from sandboxed Python inside Emacs Org-mode!')\n"
                f"#+end_src\n"
            )

            try:
                with zipfile.ZipFile(
                    tmp_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=self.config.zip_compression_level
                ) as zf:
                    # Write metadata
                    zf.writestr(".jail_metadata.json", json.dumps(metadata, indent=2))
                    # Write .emacs.d/init.el
                    zf.writestr(".emacs.d/init.el", default_init_el)
                    # Write workspace/notes.org
                    zf.writestr("workspace/notes.org", default_notes_org)

                    # Write extra files if provided
                    if extra_files:
                        for rel_path, content in extra_files.items():
                            clean_rel = rel_path.lstrip("/\\")
                            if isinstance(content, str):
                                zf.writestr(clean_rel, content)
                            else:
                                zf.writestr(clean_rel, content)

                # Atomic replace
                tmp_archive.replace(archive_path)
            except Exception as e:
                if tmp_archive.exists():
                    tmp_archive.unlink(missing_ok=True)
                raise ArchiveError(f"Failed to create initial archive for user {clean_uid}: {e}") from e

        return archive_path

    def extract_archive(self, uid: Union[str, int], target_dir: Path) -> None:
        """Extract user archive into target directory with strict Zip-Slip protection.

        Args:
            uid: Virtual user ID.
            target_dir: Target directory on filesystem.

        Raises:
            ZipSlipSecurityError: If any path inside zip points outside target_dir.
            ArchiveError: If extraction fails.
        """
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)
        target_dir = Path(target_dir).resolve()

        if not archive_path.is_file():
            # Automatically create starter archive if it does not exist
            self.create_initial_archive(clean_uid)

        target_dir.mkdir(parents=True, exist_ok=True)
        resolved_target_str = str(target_dir)

        try:
            with zipfile.ZipFile(archive_path, "r") as zf:
                for member in zf.infolist():
                    member_name = member.filename

                    # Block dangerous paths
                    if member_name.startswith("/") or member_name.startswith("\\"):
                        raise ZipSlipSecurityError(
                            f"Zip-Slip attempt detected: absolute path '{member_name}' in user archive {clean_uid}"
                        )

                    destination_path = (target_dir / member_name).resolve()

                    # Verify canonical commonpath
                    try:
                        common = os.path.commonpath([resolved_target_str, str(destination_path)])
                    except ValueError:
                        raise ZipSlipSecurityError(
                            f"Zip-Slip attempt detected across drives: '{member_name}' in user archive {clean_uid}"
                        )

                    if common != resolved_target_str:
                        raise ZipSlipSecurityError(
                            f"Zip-Slip attempt detected: '{member_name}' escapes target '{resolved_target_str}'"
                        )

                    if member.is_dir():
                        destination_path.mkdir(parents=True, exist_ok=True)
                    else:
                        destination_path.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(member) as source, open(destination_path, "wb") as target:
                            shutil.copyfileobj(source, target)

                        # Restore permissions if available
                        mode = (member.external_attr >> 16) & 0o777
                        if mode:
                            try:
                                os.chmod(destination_path, mode)
                            except OSError:
                                pass
        except ZipSlipSecurityError:
            raise
        except Exception as e:
            raise ArchiveError(f"Failed to extract archive for user {clean_uid}: {e}") from e

    def repack_archive(self, uid: Union[str, int], source_dir: Path) -> Path:
        """Repack source directory into user's single .zip archive atomically.

        Args:
            uid: Virtual user ID.
            source_dir: Directory containing updated files.

        Returns:
            Path to updated archive.
        """
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)
        source_dir = Path(source_dir).resolve()

        tmp_archive = archive_path.with_suffix(f".tmp.{os.getpid()}_{uuid.uuid4().hex[:8]}")

        # Update metadata
        metadata_file = source_dir / ".jail_metadata.json"
        metadata: Dict[str, Any] = {}
        if metadata_file.is_file():
            try:
                metadata = json.loads(metadata_file.read_text(encoding="utf-8"))
            except Exception:
                pass
        metadata["uid"] = clean_uid
        metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
        metadata_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

        # Exclude internal ephemeral runner paths
        excluded_prefixes = {".emacs_jail", ".emacs_jail_run", ".cache", ".dbus"}

        try:
            with zipfile.ZipFile(
                tmp_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=self.config.zip_compression_level
            ) as zf:
                for root, dirs, files in os.walk(source_dir):
                    # Filter out excluded directories in-place
                    dirs[:] = [d for d in dirs if d not in excluded_prefixes]

                    rel_root = Path(root).relative_to(source_dir)
                    for file_name in files:
                        if file_name in (
                            ".bash_history",
                            ".emacs_jail_lock",
                            ".bashrc",
                            ".inputrc",
                            ".profile",
                            ".Xauthority",
                        ):
                            continue
                        rel_file = rel_root / file_name
                        full_path = Path(root) / file_name

                        # Skip broken symlinks or symlinks pointing outside
                        if full_path.is_symlink():
                            try:
                                resolved = full_path.resolve()
                                if os.path.commonpath([str(source_dir), str(resolved)]) != str(source_dir):
                                    continue
                            except Exception:
                                continue

                        # Write file with attributes
                        zinfo = zipfile.ZipInfo.from_file(full_path, arcname=str(rel_file))
                        zinfo.compress_type = zipfile.ZIP_DEFLATED
                        with open(full_path, "rb") as f_in:
                            zf.writestr(zinfo, f_in.read())

            # Atomic replace to prevent corrupted zips
            tmp_archive.replace(archive_path)
            return archive_path
        except Exception as e:
            if tmp_archive.exists():
                tmp_archive.unlink(missing_ok=True)
            raise ArchiveError(f"Failed to repack archive for user {clean_uid}: {e}") from e

    def list_files(self, uid: Union[str, int]) -> List[Dict[str, Any]]:
        """List all files in user archive with metadata without extracting to disk."""
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)

        if not archive_path.is_file():
            self.create_initial_archive(clean_uid)

        results = []
        with zipfile.ZipFile(archive_path, "r") as zf:
            for info in zf.infolist():
                results.append({
                    "filename": info.filename,
                    "is_dir": info.is_dir(),
                    "file_size": info.file_size,
                    "compress_size": info.compress_size,
                    "date_time": f"{info.date_time[0]:04d}-{info.date_time[1]:02d}-{info.date_time[2]:02d} {info.date_time[3]:02d}:{info.date_time[4]:02d}:{info.date_time[5]:02d}",
                })
        return results

    def read_file(self, uid: Union[str, int], relative_path: str) -> bytes:
        """Read a file directly from user archive into memory."""
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)
        clean_rel = relative_path.lstrip("/\\")

        if not archive_path.is_file():
            raise FileNotFoundInEnvironmentError(f"User archive {clean_uid} does not exist.")

        with zipfile.ZipFile(archive_path, "r") as zf:
            try:
                return zf.read(clean_rel)
            except KeyError:
                raise FileNotFoundInEnvironmentError(
                    f"File '{clean_rel}' not found in archive for user {clean_uid}"
                )

    def write_file(self, uid: Union[str, int], relative_path: str, content: Union[str, bytes]) -> None:
        """Add or update a file directly in user archive atomically."""
        clean_uid = validate_uid(uid)
        clean_rel = relative_path.lstrip("/\\")
        archive_path = self.get_archive_path(clean_uid)

        if not archive_path.is_file():
            self.create_initial_archive(clean_uid)

        content_bytes = content.encode("utf-8") if isinstance(content, str) else content

        with self.lock(clean_uid):
            tmp_archive = archive_path.with_suffix(f".tmp.{os.getpid()}_{uuid.uuid4().hex[:8]}")
            try:
                with zipfile.ZipFile(archive_path, "r") as zf_in, zipfile.ZipFile(
                    tmp_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=self.config.zip_compression_level
                ) as zf_out:
                    # Copy existing members except target path
                    for item in zf_in.infolist():
                        if item.filename != clean_rel:
                            zf_out.writestr(item, zf_in.read(item.filename))
                    # Write updated content
                    zf_out.writestr(clean_rel, content_bytes)

                tmp_archive.replace(archive_path)
            except Exception as e:
                if tmp_archive.exists():
                    tmp_archive.unlink(missing_ok=True)
                raise ArchiveError(f"Failed to write file '{clean_rel}' for user {clean_uid}: {e}") from e

    def delete_file(self, uid: Union[str, int], relative_path: str) -> None:
        """Delete a file from user archive atomically."""
        clean_uid = validate_uid(uid)
        clean_rel = relative_path.lstrip("/\\")
        archive_path = self.get_archive_path(clean_uid)

        if not archive_path.is_file():
            return

        with self.lock(clean_uid):
            tmp_archive = archive_path.with_suffix(f".tmp.{os.getpid()}_{uuid.uuid4().hex[:8]}")
            try:
                with zipfile.ZipFile(archive_path, "r") as zf_in, zipfile.ZipFile(
                    tmp_archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=self.config.zip_compression_level
                ) as zf_out:
                    for item in zf_in.infolist():
                        if item.filename != clean_rel and not item.filename.startswith(clean_rel.rstrip("/") + "/"):
                            zf_out.writestr(item, zf_in.read(item.filename))

                tmp_archive.replace(archive_path)
            except Exception as e:
                if tmp_archive.exists():
                    tmp_archive.unlink(missing_ok=True)
                raise ArchiveError(f"Failed to delete file '{clean_rel}' for user {clean_uid}: {e}") from e

    def get_metadata(self, uid: Union[str, int]) -> Dict[str, Any]:
        """Retrieve user environment metadata and disk size."""
        clean_uid = validate_uid(uid)
        archive_path = self.get_archive_path(clean_uid)

        if not archive_path.is_file():
            self.create_initial_archive(clean_uid)

        metadata: Dict[str, Any] = {}
        try:
            data = self.read_file(clean_uid, ".jail_metadata.json")
            metadata = json.loads(data.decode("utf-8"))
        except Exception:
            metadata = {"uid": clean_uid}

        metadata["archive_size_bytes"] = archive_path.stat().st_size
        metadata["archive_path"] = str(archive_path)
        return metadata

    def list_users(self) -> List[Dict[str, Any]]:
        """List all registered virtual user environments in storage."""
        results = []
        for p in self.config.storage_dir.glob("*.zip"):
            clean_uid = p.stem
            try:
                validate_uid(clean_uid)
                meta = self.get_metadata(clean_uid)
                results.append(meta)
            except Exception:
                continue
        return results
