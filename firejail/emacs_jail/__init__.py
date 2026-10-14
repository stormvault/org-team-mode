"""Emacs-Jail: Firejail Framework for Isolated Multi-Tenant Emacs & Org-Mode Execution.

Provides chroot-like, single-file zip archived environments for non-system user IDs (UIDs).
"""

from emacs_jail.archive import ArchiveLock, UserArchiveManager, validate_uid
from emacs_jail.config import JailConfig
from emacs_jail.emacs import BabelResult, EmacsOrgManager, ExportResult
from emacs_jail.exceptions import (
    ArchiveError,
    EmacsJailError,
    InvalidUserIdError,
    LockTimeoutError,
    OrgModeError,
    SandboxExecutionError,
    ZipSlipSecurityError,
)
from emacs_jail.sandbox import FirejailRunner, SandboxResult
from emacs_jail.user_env import UserEnvironment

__version__ = "1.0.0"

__all__ = [
    "ArchiveError",
    "ArchiveLock",
    "BabelResult",
    "EmacsJailError",
    "EmacsOrgManager",
    "ExportResult",
    "FirejailRunner",
    "InvalidUserIdError",
    "JailConfig",
    "LockTimeoutError",
    "OrgModeError",
    "SandboxExecutionError",
    "SandboxResult",
    "UserArchiveManager",
    "UserEnvironment",
    "ZipSlipSecurityError",
    "validate_uid",
]
