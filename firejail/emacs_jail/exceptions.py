"""Exception hierarchy for Emacs-Jail framework."""

class EmacsJailError(Exception):
    """Base exception for all Emacs-Jail errors."""


class InvalidUserIdError(EmacsJailError):
    """Raised when an invalid or unsafe virtual user ID is supplied."""


class ArchiveError(EmacsJailError):
    """Raised when reading, extracting, or writing the user zip archive fails."""


class ZipSlipSecurityError(ArchiveError):
    """Raised when an archive member attempts directory traversal outside the target root."""


class FileNotFoundInEnvironmentError(ArchiveError):
    """Raised when a requested file is not found inside the user's environment."""


class SandboxExecutionError(EmacsJailError):
    """Raised when Firejail execution fails, exits with non-zero code, or times out."""
    def __init__(self, message: str, returncode: int | None = None, stdout: str = "", stderr: str = ""):
        super().__init__(message)
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class LockTimeoutError(EmacsJailError):
    """Raised when failing to acquire the user environment file lock within the timeout."""


class OrgModeError(EmacsJailError):
    """Raised when Org-mode export, babel, or elisp operation encounters an error."""
    def __init__(self, message: str, details: str = ""):
        super().__init__(message)
        self.details = details
