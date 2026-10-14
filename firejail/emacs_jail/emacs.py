"""Specialized Emacs & Org-Mode execution manager for Emacs-Jail."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from emacs_jail.config import JailConfig
from emacs_jail.exceptions import OrgModeError
from emacs_jail.sandbox import SandboxResult
from emacs_jail.user_env import UserEnvironment


@dataclass
class ExportResult:
    """Result of an Org-mode document export."""
    success: bool
    output_filename: str
    content: str | None = None
    bytes_content: bytes | None = None
    execution_time: float = 0.0
    stdout: str = ""
    stderr: str = ""


@dataclass
class BabelResult:
    """Result of an Org-Babel execution or tangling operation."""
    success: bool
    action: str
    target_file: str
    tangled_files: list[str]
    content: str | None = None
    execution_time: float = 0.0
    stdout: str = ""
    stderr: str = ""


class EmacsOrgManager:
    """High-level Org-Mode operations engine within isolated virtual user environments."""

    def __init__(self, config: JailConfig | None = None):
        self.config = config or JailConfig()

    def export(
        self,
        uid: str | int,
        org_file: str,
        export_format: str = "html",
        output_file: str | None = None,
        return_content: bool = True,
    ) -> ExportResult:
        """Export an Org document to HTML, Markdown, Plain Text, or LaTeX in isolation.

        Args:
            uid: Virtual user ID.
            org_file: Path to .org file relative to workspace.
            export_format: Target format ("html", "md", "txt", "latex", "org").
            output_file: Optional explicit output destination name.
            return_content: Whether to load and return the exported file content.

        Returns:
            ExportResult containing status, output filename, and exported content.
        """
        fmt = export_format.lower().strip()
        default_exts = {
            "html": ".html",
            "md": ".md",
            "markdown": ".md",
            "txt": ".txt",
            "ascii": ".txt",
            "latex": ".tex",
            "tex": ".tex",
            "org": ".org",
        }
        if fmt not in default_exts:
            raise OrgModeError(f"Unsupported export format '{export_format}'. Supported: {list(default_exts.keys())}")

        dest_name = output_file or Path(org_file).stem + default_exts[fmt]

        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            # Verify input file exists
            env.resolve_path(org_file, must_exist=True)

            args = [
                "-Q",
                "--batch",
                "-l",
                "~/.emacs_jail/lisp/org-export-runner.el",
                "--",
                "--input",
                org_file,
                "--format",
                fmt,
                "--output",
                dest_name,
            ]

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Org export failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            # Check that exported file exists
            exported_bytes = None
            exported_str = None
            if return_content:
                try:
                    exported_bytes = env.read_workspace_file(dest_name)
                    try:
                        exported_str = exported_bytes.decode("utf-8")
                    except UnicodeDecodeError:
                        exported_str = None
                except Exception as e:
                    raise OrgModeError(f"Failed to read exported output '{dest_name}': {e}") from e

            return ExportResult(
                success=True,
                output_filename=dest_name,
                content=exported_str,
                bytes_content=exported_bytes,
                execution_time=result.execution_time,
                stdout=result.stdout,
                stderr=result.stderr,
            )

    def babel_execute(
        self,
        uid: str | int,
        org_file: str,
        output_file: str | None = None,
    ) -> BabelResult:
        """Execute all Org-Babel code blocks inside an Org file in zero-trust sandbox.

        Args:
            uid: Virtual user ID.
            org_file: Path to .org file relative to workspace.
            output_file: Output destination (defaults to overwriting org_file with results).

        Returns:
            BabelResult with status and updated document content.
        """
        dest_name = output_file or org_file

        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            env.resolve_path(org_file, must_exist=True)

            args = [
                "-Q",
                "--batch",
                "-l",
                "~/.emacs_jail/lisp/org-babel-runner.el",
                "--",
                "--input",
                org_file,
                "--action",
                "execute",
                "--output",
                dest_name,
            ]

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Org-Babel execution failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            updated_bytes = env.read_workspace_file(dest_name)
            updated_text = updated_bytes.decode("utf-8", errors="replace")

            return BabelResult(
                success=True,
                action="execute",
                target_file=dest_name,
                tangled_files=[],
                content=updated_text,
                execution_time=result.execution_time,
                stdout=result.stdout,
                stderr=result.stderr,
            )

    def babel_tangle(
        self,
        uid: str | int,
        org_file: str,
    ) -> BabelResult:
        """Tangle (extract) source code blocks from literate Org file.

        Args:
            uid: Virtual user ID.
            org_file: Path to .org file relative to workspace.

        Returns:
            BabelResult with list of tangled source files created in workspace.
        """
        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            env.resolve_path(org_file, must_exist=True)

            args = [
                "-Q",
                "--batch",
                "-l",
                "~/.emacs_jail/lisp/org-babel-runner.el",
                "--",
                "--input",
                org_file,
                "--action",
                "tangle",
            ]

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Org-Babel tangle failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            # Parse tangled files from stdout or stderr
            tangled_files = []
            combined_output = (result.stdout or "") + "\n" + (result.stderr or "")
            for line in combined_output.splitlines():
                if "BABEL_TANGLE_SUCCESS:" in line:
                    files_str = line.split("BABEL_TANGLE_SUCCESS:", 1)[1].strip()
                    if files_str:
                        tangled_files = [f.strip() for f in files_str.split(",") if f.strip()]

            return BabelResult(
                success=True,
                action="tangle",
                target_file=org_file,
                tangled_files=tangled_files,
                execution_time=result.execution_time,
                stdout=result.stdout,
                stderr=result.stderr,
            )

    def setup_org_mode(
        self,
        uid: str | int,
        workspace_override: str | None = None,
    ) -> BabelResult:
        """Write NorAng org-mode.org to workspace, open in buffer, load Org mode, and tangle org-mode.el with C-c C-v C-t.

        Args:
            uid: Virtual user ID.
            workspace_override: Optional explicit workspace path relative to environment.

        Returns:
            BabelResult with tangled files created in user workspace.
        """
        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            args = [
                "-Q",
                "--batch",
                "-l",
                "~/.emacs_jail/lisp/org-mode-setup.el",
            ]
            if workspace_override:
                args.extend(["--", "--workspace", workspace_override])

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Setup Org-Mode failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            tangled_files = []
            combined_output = (result.stdout or "") + "\n" + (result.stderr or "")
            for line in combined_output.splitlines():
                if "BABEL_TANGLE_SUCCESS:" in line or "org-mode.el" in line:
                    if "org-mode.el" not in tangled_files:
                        tangled_files.append("org-mode.el")

            if "org-mode.el" not in tangled_files:
                try:
                    if env.resolve_path("org-mode.el").exists():
                        tangled_files.append("org-mode.el")
                except Exception:
                    pass

            return BabelResult(
                success=True,
                action="setup_tangle",
                target_file="org-mode.org",
                tangled_files=tangled_files,
                execution_time=result.execution_time,
                stdout=result.stdout,
                stderr=result.stderr,
            )


    def get_agenda(
        self,
        uid: str | int,
        files: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        """Extract structured headlines, TODOs, deadlines, and schedules as JSON.

        Args:
            uid: Virtual user ID.
            files: Specific .org files to inspect, or None for all in workspace.

        Returns:
            List of headline dictionary objects.
        """
        with UserEnvironment(uid, config=self.config, readonly=True) as env:
            args = [
                "-Q",
                "--batch",
                "-l",
                "~/.emacs_jail/lisp/org-agenda-runner.el",
            ]
            if files:
                args.extend(["--", "--files", ",".join(files)])

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Org agenda extraction failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            # Find AGENDA_JSON: line
            for line in result.stdout.splitlines():
                if "AGENDA_JSON:" in line:
                    json_str = line.split("AGENDA_JSON:", 1)[1].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e:
                        raise OrgModeError(f"Failed to parse agenda JSON: {e}") from e

            # If not found in stdout, check stderr or output
            for line in result.stderr.splitlines():
                if "AGENDA_JSON:" in line:
                    json_str = line.split("AGENDA_JSON:", 1)[1].strip()
                    try:
                        return json.loads(json_str)
                    except json.JSONDecodeError as e:
                        raise OrgModeError(f"Failed to parse agenda JSON: {e}") from e

            return []

    def eval_elisp(
        self,
        uid: str | int,
        elisp_expr: str,
        load_org: bool = True,
        load_user_init: bool = False,
    ) -> str:
        """Evaluate an Emacs Lisp expression within the isolated user environment.

        Args:
            uid: Virtual user ID.
            elisp_expr: Elisp expression string to evaluate.
            load_org: Whether to preload Org-mode.
            load_user_init: Whether to load user's ~/.emacs.d/init.el.

        Returns:
            Standard output / evaluation message from Emacs.
        """
        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            args = []
            if not load_user_init:
                args.append("-Q")
            args.append("--batch")

            if load_org:
                args.extend(["--eval", "(require 'org)"])

            args.extend(["--eval", f"(message \"%S\" (progn {elisp_expr}))"])

            result = env.run_emacs(args)

            if not result.success:
                raise OrgModeError(
                    f"Elisp evaluation failed with exit code {result.returncode}",
                    details=result.stderr or result.stdout,
                )

            # Extract last line or output
            output = result.stdout.strip()
            if not output and result.stderr:
                output = result.stderr.strip()
            return output

    def run_batch(
        self,
        uid: str | int,
        script_file: str | None = None,
        elisp_expr: str | None = None,
        extra_args: list[str] | None = None,
    ) -> SandboxResult:
        """Run custom batch Emacs command."""
        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            args = ["-Q", "--batch"]
            if script_file:
                resolved = env.resolve_path(script_file, must_exist=True)
                args.extend(["-l", str(resolved)])
            if elisp_expr:
                args.extend(["--eval", elisp_expr])
            if extra_args:
                args.extend(extra_args)

            return env.run_emacs(args)

    def interactive(self, uid: str | int, emacs_args: list[str] | None = None) -> int:
        """Launch interactive Emacs in Firejail for user UID."""
        with UserEnvironment(uid, config=self.config, readonly=False) as env:
            return env.runner.run_interactive(
                runtime_dir=env.runtime_dir,
                emacs_args=emacs_args or ["-nw"],
                uid=env.uid,
            )
