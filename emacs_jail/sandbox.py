"""Firejail sandboxing execution engine for Emacs processes."""

import os
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Union

from emacs_jail.config import JailConfig
from emacs_jail.exceptions import SandboxExecutionError


@dataclass
class SandboxResult:
    """Result of a command executed inside the Firejail sandbox."""
    returncode: int
    stdout: str
    stderr: str
    execution_time: float

    @property
    def success(self) -> bool:
        return self.returncode == 0


class FirejailRunner:
    """Executes Emacs commands in a zero-trust Firejail sandbox."""

    def __init__(self, config: Optional[JailConfig] = None):
        self.config = config or JailConfig()

    def setup_runtime_helpers(self, runtime_dir: Path) -> Path:
        """Inject helper Lisp scripts into runtime directory so they are accessible inside sandbox."""
        helpers_target = runtime_dir / ".emacs_jail" / "lisp"
        helpers_target.mkdir(parents=True, exist_ok=True)

        if self.config.lisp_dir.is_dir():
            for item in self.config.lisp_dir.glob("*.el"):
                shutil.copy2(item, helpers_target / item.name)

        return helpers_target

    def build_firejail_command(
        self,
        runtime_dir: Path,
        emacs_args: List[str],
        profile_override: Optional[Path] = None,
        enable_network: Optional[bool] = None,
        uid: Optional[str] = None,
    ) -> List[str]:
        """Construct the complete firejail invocation command."""
        net = self.config.enable_network if enable_network is None else enable_network

        if profile_override:
            profile = profile_override
        elif net:
            profile = self.config.network_profile_path
        else:
            profile = self.config.profile_path

        cmd = [
            str(self.config.firejail_bin),
            "--quiet",
            f"--profile={profile}",
            f"--private={runtime_dir}",
            f"--rlimit-cpu={self.config.cpu_limit_seconds}",
            f"--rlimit-as={self.config.memory_limit_bytes}",
            f"--rlimit-nproc={self.config.max_procs}",
            f"--rlimit-fsize={self.config.max_file_size_bytes}",
        ]

        if not net:
            cmd.append("--net=none")

        # Pass environment variables
        cmd.extend([
            "--env=LANG=en_US.UTF-8",
            "--env=LC_ALL=en_US.UTF-8",
            "--env=EMACS_JAIL=1",
        ])
        if uid:
            cmd.append(f"--env=JAIL_USER_UID={uid}")

        # Target executable (real emacs binary)
        cmd.append(str(self.config.emacs_bin))

        # Append emacs arguments
        cmd.extend(emacs_args)

        return cmd

    def run_in_sandbox(
        self,
        runtime_dir: Path,
        emacs_args: List[str],
        timeout: Optional[float] = None,
        stdin_input: Optional[str] = None,
        profile_override: Optional[Path] = None,
        enable_network: Optional[bool] = None,
        uid: Optional[str] = None,
        cwd: Optional[Path] = None,
    ) -> SandboxResult:
        """Run an Emacs command synchronously inside the Firejail sandbox.

        Args:
            runtime_dir: Unpacked user runtime directory.
            emacs_args: Arguments passed to Emacs.
            timeout: Maximum execution duration in seconds.
            stdin_input: String sent to stdin.
            profile_override: Custom profile path.
            enable_network: Explicit network override.
            uid: Virtual user ID for metadata and environment.
            cwd: Working directory on host (defaults to runtime_dir).

        Returns:
            SandboxResult with exit code, stdout, stderr, and duration.

        Raises:
            SandboxExecutionError: If command times out or cannot be started.
        """
        self.setup_runtime_helpers(runtime_dir)

        cmd = self.build_firejail_command(
            runtime_dir=runtime_dir,
            emacs_args=emacs_args,
            profile_override=profile_override,
            enable_network=enable_network,
            uid=uid,
        )

        working_dir = cwd or runtime_dir
        exec_timeout = timeout or self.config.timeout_seconds
        start_time = time.monotonic()

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(working_dir),
                input=stdin_input,
                capture_output=True,
                text=True,
                timeout=exec_timeout,
                check=False,
            )
            duration = time.monotonic() - start_time
            return SandboxResult(
                returncode=proc.returncode,
                stdout=proc.stdout,
                stderr=proc.stderr,
                execution_time=duration,
            )
        except subprocess.TimeoutExpired as e:
            duration = time.monotonic() - start_time
            raise SandboxExecutionError(
                f"Emacs execution timed out after {exec_timeout} seconds in Firejail sandbox.",
                returncode=-1,
                stdout=e.stdout.decode("utf-8", errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or ""),
                stderr=e.stderr.decode("utf-8", errors="replace") if isinstance(e.stderr, bytes) else (e.stderr or ""),
            ) from e
        except Exception as e:
            raise SandboxExecutionError(f"Failed to start Firejail sandbox: {e}") from e

    def run_interactive(
        self,
        runtime_dir: Path,
        emacs_args: Optional[List[str]] = None,
        uid: Optional[str] = None,
    ) -> int:
        """Run an interactive Emacs session connected to the current terminal.

        Args:
            runtime_dir: Unpacked user runtime directory.
            emacs_args: Arguments (e.g. ['-nw'] for terminal UI).
            uid: Virtual user ID.

        Returns:
            Process exit code.
        """
        self.setup_runtime_helpers(runtime_dir)
        args = emacs_args or ["-nw"]

        cmd = self.build_firejail_command(
            runtime_dir=runtime_dir,
            emacs_args=args,
            uid=uid,
        )
        return subprocess.call(cmd, cwd=str(runtime_dir))
