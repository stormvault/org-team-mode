"""Emacs-Jail: Firejail Framework for Isolated Multi-Tenant Emacs & Org-Mode Execution.

Provides chroot-like, single-file zip archived environments for non-system user IDs (UIDs).
"""

from emacs_jail.config import JailConfig
from emacs_jail.exceptions import (
    EmacsJailError,
    InvalidUserIdError,
    ArchiveError,
    ZipSlipSecurityError,
    SandboxExecutionError,
    LockTimeoutError,
    OrgModeError,
)
from emacs_jail.archive import UserArchiveManager, ArchiveLock, validate_uid
from emacs_jail.sandbox import FirejailRunner, SandboxResult
from emacs_jail.user_env import UserEnvironment
from emacs_jail.emacs import EmacsOrgManager, ExportResult, BabelResult

__version__ = "1.0.0"

__all__ = [
    "JailConfig",
    "EmacsJailError",
    "InvalidUserIdError",
    "ArchiveError",
    "ZipSlipSecurityError",
    "SandboxExecutionError",
    "LockTimeoutError",
    "OrgModeError",
    "UserArchiveManager",
    "ArchiveLock",
    "validate_uid",
    "FirejailRunner",
    "SandboxResult",
    "UserEnvironment",
    "EmacsOrgManager",
    "ExportResult",
    "BabelResult",
]
