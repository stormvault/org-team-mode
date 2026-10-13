"""Google Antigravity SDK & Agent Tools Integration for Emacs-Jail.

Allows AI agents to execute, query, and manage isolated Emacs Org-Mode
environments for arbitrary virtual users (non-system UIDs).
"""

from typing import Any, Dict, List, Optional
from emacs_jail.archive import UserArchiveManager
from emacs_jail.config import JailConfig
from emacs_jail.emacs import EmacsOrgManager


_default_config = JailConfig()
_archive_mgr = UserArchiveManager(_default_config)
_emacs_mgr = EmacsOrgManager(_default_config)


def emacs_user_environment_init(uid: str, description: Optional[str] = None) -> Dict[str, Any]:
    """Initialize a persistent, isolated sandbox environment for a virtual user UID.

    Args:
        uid: Virtual non-system user identifier (e.g. 'tenant_101', 'user_alice').
        description: Optional notes or description for this user's environment.

    Returns:
        Dict with status, uid, archive path, and created files.
    """
    archive_path = _archive_mgr.create_initial_archive(uid)
    metadata = _archive_mgr.get_metadata(uid)
    files = _archive_mgr.list_files(uid)
    return {
        "status": "success",
        "uid": uid,
        "archive_path": str(archive_path),
        "metadata": metadata,
        "file_count": len(files),
    }


def emacs_user_list_environments() -> List[Dict[str, Any]]:
    """List all registered virtual user environments and their storage metrics."""
    return _archive_mgr.list_users()


def emacs_org_export(
    uid: str,
    org_file: str,
    export_format: str = "html",
    output_file: Optional[str] = None,
) -> Dict[str, Any]:
    """Export an Org-Mode document inside a virtual user's isolated Firejail sandbox.

    Args:
        uid: Virtual user identifier.
        org_file: Path to the .org document relative to the user's workspace (e.g. 'notes.org').
        export_format: Target format ('html', 'md', 'txt', 'latex', 'org'). Default is 'html'.
        output_file: Optional target filename for the exported document.

    Returns:
        Dict with export status, output filename, execution time, and generated content.
    """
    res = _emacs_mgr.export(
        uid=uid,
        org_file=org_file,
        export_format=export_format,
        output_file=output_file,
        return_content=True,
    )
    return {
        "status": "success" if res.success else "error",
        "uid": uid,
        "output_filename": res.output_filename,
        "execution_time_seconds": round(res.execution_time, 3),
        "content": res.content,
    }


def emacs_org_babel_execute(
    uid: str,
    org_file: str,
    output_file: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute code blocks (Python, Elisp, Bash) inside an Org document in a zero-trust sandbox.

    Args:
        uid: Virtual user identifier.
        org_file: Path to the .org document relative to workspace.
        output_file: Optional destination path (defaults to updating the org_file in place).

    Returns:
        Dict with execution status, target file, and resulting document text with #+RESULTS: blocks.
    """
    res = _emacs_mgr.babel_execute(uid=uid, org_file=org_file, output_file=output_file)
    return {
        "status": "success" if res.success else "error",
        "uid": uid,
        "target_file": res.target_file,
        "execution_time_seconds": round(res.execution_time, 3),
        "content": res.content,
    }


def emacs_org_babel_tangle(uid: str, org_file: str) -> Dict[str, Any]:
    """Extract (tangle) code blocks from a literate Org file into runnable source code files.

    Args:
        uid: Virtual user identifier.
        org_file: Path to .org document relative to workspace.

    Returns:
        Dict with status and list of tangled source code filenames.
    """
    res = _emacs_mgr.babel_tangle(uid=uid, org_file=org_file)
    return {
        "status": "success" if res.success else "error",
        "uid": uid,
        "tangled_files": res.tangled_files,
        "execution_time_seconds": round(res.execution_time, 3),
    }


def emacs_org_get_agenda(uid: str, files: Optional[List[str]] = None) -> Dict[str, Any]:
    """Extract structured tasks, TODO items, priorities, deadlines, and headlines from user's Org files.

    Args:
        uid: Virtual user identifier.
        files: Optional list of specific .org files inside workspace. If omitted, scans all .org files.

    Returns:
        Dict containing list of structured task items with title, state, priority, tags, schedule, deadline.
    """
    items = _emacs_mgr.get_agenda(uid=uid, files=files)
    return {
        "status": "success",
        "uid": uid,
        "task_count": len(items),
        "items": items,
    }


def emacs_eval_elisp(uid: str, elisp_expression: str) -> Dict[str, Any]:
    """Evaluate an arbitrary Emacs Lisp expression safely inside the user's Firejail sandbox.

    Args:
        uid: Virtual user identifier.
        elisp_expression: S-expression string to evaluate (e.g. '(org-version)').

    Returns:
        Dict with status and output result.
    """
    out = _emacs_mgr.eval_elisp(uid=uid, elisp_expr=elisp_expression)
    return {
        "status": "success",
        "uid": uid,
        "output": out,
    }


def emacs_user_put_file(uid: str, filepath: str, content: str) -> Dict[str, Any]:
    """Store or update a file directly in the virtual user's persistent ZIP archive.

    Args:
        uid: Virtual user identifier.
        filepath: Relative destination path inside archive (e.g. 'workspace/my_project.org').
        content: Text content of the file.

    Returns:
        Dict with status and file size.
    """
    _archive_mgr.write_file(uid=uid, relative_path=filepath, content=content)
    return {
        "status": "success",
        "uid": uid,
        "filepath": filepath,
        "bytes_written": len(content.encode("utf-8")),
    }


def emacs_user_get_file(uid: str, filepath: str) -> Dict[str, Any]:
    """Retrieve the text content of a file from the virtual user's persistent ZIP archive.

    Args:
        uid: Virtual user identifier.
        filepath: Relative path inside archive.

    Returns:
        Dict with file content and status.
    """
    data = _archive_mgr.read_file(uid=uid, relative_path=filepath)
    text = data.decode("utf-8", errors="replace")
    return {
        "status": "success",
        "uid": uid,
        "filepath": filepath,
        "content": text,
        "size_bytes": len(data),
    }


def emacs_user_list_files(uid: str) -> Dict[str, Any]:
    """List all files and directories in the virtual user's persistent ZIP archive.

    Args:
        uid: Virtual user identifier.

    Returns:
        Dict with list of file objects and total size.
    """
    files = _archive_mgr.list_files(uid=uid)
    return {
        "status": "success",
        "uid": uid,
        "files": files,
        "total_files": len(files),
    }


# Export all agent tools in a list for direct binding to Google Antigravity SDK LocalAgentConfig
ANTIGRAVITY_TOOLS = [
    emacs_user_environment_init,
    emacs_user_list_environments,
    emacs_org_export,
    emacs_org_babel_execute,
    emacs_org_babel_tangle,
    emacs_org_get_agenda,
    emacs_eval_elisp,
    emacs_user_put_file,
    emacs_user_get_file,
    emacs_user_list_files,
]
