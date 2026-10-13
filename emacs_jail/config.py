"""Configuration management for Emacs-Jail framework."""

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class JailConfig:
    """Configuration settings for Emacs-Jail environment and execution."""

    # Storage directory where persistent single-file <uid>.zip archives reside
    storage_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("EMACS_JAIL_STORAGE_DIR", Path(__file__).resolve().parent.parent / "data" / "users")
        )
    )

    # Base directory where ephemeral sandbox runtime directories are unpacked
    runtime_base_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("EMACS_JAIL_RUNTIME_DIR", Path("/tmp/emacs_jail_run"))
        )
    )

    # Path to real Emacs binary (prefer /usr/bin/emacs to prevent nested wrappers)
    emacs_bin: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "EMACS_BIN",
                "/usr/bin/emacs" if os.path.exists("/usr/bin/emacs") else (shutil.which("emacs") or "emacs")
            )
        )
    )

    # Path to Firejail binary
    firejail_bin: Path = field(
        default_factory=lambda: Path(
            os.environ.get("FIREJAIL_BIN", shutil.which("firejail") or "/usr/bin/firejail")
        )
    )

    # Path to Firejail profile files
    profile_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "EMACS_JAIL_PROFILE",
                Path(__file__).resolve().parent.parent / "firejail" / "emacs-org.profile"
            )
        )
    )

    strict_profile_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "EMACS_JAIL_STRICT_PROFILE",
                Path(__file__).resolve().parent.parent / "firejail" / "emacs-strict.profile"
            )
        )
    )

    network_profile_path: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "EMACS_JAIL_NETWORK_PROFILE",
                Path(__file__).resolve().parent.parent / "firejail" / "emacs-network.profile"
            )
        )
    )

    # Path to Lisp helper scripts
    lisp_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "EMACS_JAIL_LISP_DIR",
                Path(__file__).resolve().parent.parent / "lisp"
            )
        )
    )

    # Execution controls & resource limits
    enable_network: bool = False
    cpu_limit_seconds: int = 60
    memory_limit_bytes: int = 1073741824  # 1 GB
    max_procs: int = 128
    max_file_size_bytes: int = 104857600  # 100 MB
    timeout_seconds: float = 90.0

    # Multi-tenant concurrency lock timeout
    lock_timeout_seconds: float = 20.0

    # Zip compression level (1-9)
    zip_compression_level: int = 6

    def __post_init__(self):
        """Ensure directories exist and resolve paths."""
        self.storage_dir = Path(self.storage_dir).resolve()
        self.runtime_base_dir = Path(self.runtime_base_dir).resolve()
        self.emacs_bin = Path(self.emacs_bin).resolve()
        self.firejail_bin = Path(self.firejail_bin).resolve()
        self.profile_path = Path(self.profile_path).resolve()
        self.strict_profile_path = Path(self.strict_profile_path).resolve()
        self.network_profile_path = Path(self.network_profile_path).resolve()
        self.lisp_dir = Path(self.lisp_dir).resolve()

        # Create base storage and runtime folders
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.runtime_base_dir.mkdir(parents=True, exist_ok=True)
