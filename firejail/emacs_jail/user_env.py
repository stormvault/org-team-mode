"""Lifecycle manager for virtual user environments."""

import os
import shutil
import uuid
from pathlib import Path

from emacs_jail.archive import ArchiveLock, UserArchiveManager, validate_uid
from emacs_jail.config import JailConfig
from emacs_jail.exceptions import FileNotFoundInEnvironmentError, ZipSlipSecurityError
from emacs_jail.sandbox import FirejailRunner, SandboxResult


class UserEnvironment:
    """Manages an active, isolated runtime session for a virtual non-system user UID."""

    def __init__(
        self,
        uid: str | int,
        config: JailConfig | None = None,
        readonly: bool = False,
    ):
        self.config = config or JailConfig()
        self.uid = validate_uid(uid)
        self.readonly = readonly
        self.archive_mgr = UserArchiveManager(self.config)
        self.runner = FirejailRunner(self.config)

        self.session_id = uuid.uuid4().hex[:12]
        self.runtime_dir = self.config.runtime_base_dir / f"user_{self.uid}_{self.session_id}"
        self.workspace_dir = self.runtime_dir / "workspace"

        self._lock: ArchiveLock | None = None
        self._is_active = False
        self._is_dirty = False

    def __enter__(self) -> "UserEnvironment":
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close(save_changes=not self.readonly and exc_type is None)

    def open(self) -> None:
        """Acquire lock, extract archive into runtime directory, and initialize session."""
        if self._is_active:
            return

        # Acquire lock for this user
        self._lock = ArchiveLock(
            self.archive_mgr.get_lock_path(self.uid),
            timeout=self.config.lock_timeout_seconds,
        )
        self._lock.acquire()

        try:
            # Extract user archive to runtime directory
            self.archive_mgr.extract_archive(self.uid, self.runtime_dir)
            self.workspace_dir.mkdir(parents=True, exist_ok=True)
            self.runner.setup_runtime_helpers(self.runtime_dir)
            self._is_active = True
        except Exception:
            self._cleanup_runtime()
            if self._lock:
                self._lock.release()
                self._lock = None
            raise

    def close(self, save_changes: bool = True) -> None:
        """Repack archive if requested and clean up runtime environment."""
        if not self._is_active:
            return

        try:
            if save_changes and not self.readonly:
                self.commit()
        finally:
            self._cleanup_runtime()
            self._is_active = False
            if self._lock:
                self._lock.release()
                self._lock = None

    def commit(self) -> Path:
        """Persist current runtime directory state back into the single-file .zip archive."""
        if not self._is_active:
            raise RuntimeError("Cannot commit an inactive environment.")
        archive_path = self.archive_mgr.repack_archive(self.uid, self.runtime_dir)
        self._is_dirty = False
        return archive_path

    def _cleanup_runtime(self) -> None:
        """Remove ephemeral runtime directory safely."""
        if self.runtime_dir.exists():
            try:
                shutil.rmtree(self.runtime_dir, ignore_errors=True)
            except Exception:
                pass

    def resolve_path(self, relative_path: str, must_exist: bool = False) -> Path:
        """Safely resolve a path relative to workspace (or root) ensuring no breakout.

        Args:
            relative_path: Path inside user workspace or environment.
            must_exist: If True, raises error if file does not exist.
        """
        clean_rel = relative_path.lstrip("/\\")
        candidate = (self.workspace_dir / clean_rel).resolve()
        runtime_str = str(self.runtime_dir.resolve())

        # Check if caller specified a path from root (e.g. .emacs.d/init.el)
        if not candidate.exists():
            alt_candidate = (self.runtime_dir / clean_rel).resolve()
            if alt_candidate.exists():
                candidate = alt_candidate

        if os.path.commonpath([runtime_str, str(candidate)]) != runtime_str:
            raise ZipSlipSecurityError(f"Access denied: path '{relative_path}' escapes sandbox boundary.")

        if must_exist and not candidate.exists():
            raise FileNotFoundInEnvironmentError(f"Path '{relative_path}' not found in user environment.")

        return candidate

    def run_emacs(
        self,
        args: list[str],
        timeout: float | None = None,
        stdin_input: str | None = None,
        enable_network: bool | None = None,
        profile_override: Path | None = None,
    ) -> SandboxResult:
        """Execute Emacs in this user's sandboxed environment."""
        if not self._is_active:
            raise RuntimeError("Environment is not active. Use within 'with UserEnvironment(...)'.")

        self._is_dirty = True
        return self.runner.run_in_sandbox(
            runtime_dir=self.runtime_dir,
            emacs_args=args,
            timeout=timeout,
            stdin_input=stdin_input,
            enable_network=enable_network,
            profile_override=profile_override,
            uid=self.uid,
            cwd=self.workspace_dir,
        )

    def write_workspace_file(self, relative_path: str, content: str | bytes) -> Path:
        """Write a file directly into the active user workspace."""
        dest = self.resolve_path(relative_path, must_exist=False)
        dest.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(content, str):
            dest.write_text(content, encoding="utf-8")
        else:
            dest.write_bytes(content)
        self._is_dirty = True
        return dest

    def read_workspace_file(self, relative_path: str) -> bytes:
        """Read a file directly from the active user workspace."""
        target = self.resolve_path(relative_path, must_exist=True)
        return target.read_bytes()

    def list_workspace_files(self) -> list[Path]:
        """List all files in the active workspace directory."""
        if not self.workspace_dir.exists():
            return []
        return [p for p in self.workspace_dir.rglob("*") if p.is_file()]
