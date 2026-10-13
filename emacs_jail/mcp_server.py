"""Model Context Protocol (MCP) server for Emacs-Jail.

Exposes Emacs & Org-Mode sandbox tools to AI agents and external tools via MCP stdio/SSE.
"""

import sys
from typing import Any, Dict, List, Optional

from mcp.server.mcpserver import MCPServer
from emacs_jail import agent_tools

server = MCPServer(
    name="emacs-jail",
    instructions="Isolated Emacs and Org-Mode execution framework using Firejail and persistent single-file ZIP environments.",
)


@server.tool(name="emacs_init_user_environment")
def tool_init_env(uid: str, description: Optional[str] = None) -> Dict[str, Any]:
    """Initialize a persistent, isolated sandbox environment for a virtual user UID."""
    return agent_tools.emacs_user_environment_init(uid, description)


@server.tool(name="emacs_list_user_environments")
def tool_list_envs() -> List[Dict[str, Any]]:
    """List all registered virtual user environments and their storage metrics."""
    return agent_tools.emacs_user_list_environments()


@server.tool(name="emacs_org_export")
def tool_org_export(
    uid: str,
    org_file: str,
    export_format: str = "html",
    output_file: Optional[str] = None,
) -> Dict[str, Any]:
    """Export an Org-Mode document inside a virtual user's isolated Firejail sandbox to HTML, Markdown, etc."""
    return agent_tools.emacs_org_export(uid, org_file, export_format, output_file)


@server.tool(name="emacs_org_babel_execute")
def tool_babel_execute(
    uid: str,
    org_file: str,
    output_file: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute code blocks (Python, Elisp, Bash) inside an Org document in a zero-trust sandbox."""
    return agent_tools.emacs_org_babel_execute(uid, org_file, output_file)


@server.tool(name="emacs_org_babel_tangle")
def tool_babel_tangle(uid: str, org_file: str) -> Dict[str, Any]:
    """Extract (tangle) code blocks from a literate Org file into runnable source code files."""
    return agent_tools.emacs_org_babel_tangle(uid, org_file)


@server.tool(name="emacs_org_get_agenda")
def tool_get_agenda(uid: str, files: Optional[List[str]] = None) -> Dict[str, Any]:
    """Extract structured tasks, TODO items, priorities, deadlines, and headlines from user's Org files."""
    return agent_tools.emacs_org_get_agenda(uid, files)


@server.tool(name="emacs_eval_elisp")
def tool_eval_elisp(uid: str, elisp_expression: str) -> Dict[str, Any]:
    """Evaluate an arbitrary Emacs Lisp expression safely inside the user's Firejail sandbox."""
    return agent_tools.emacs_eval_elisp(uid, elisp_expression)


@server.tool(name="emacs_user_put_file")
def tool_put_file(uid: str, filepath: str, content: str) -> Dict[str, Any]:
    """Store or update a file directly in the virtual user's persistent ZIP archive."""
    return agent_tools.emacs_user_put_file(uid, filepath, content)


@server.tool(name="emacs_user_get_file")
def tool_get_file(uid: str, filepath: str) -> Dict[str, Any]:
    """Retrieve the text content of a file from the virtual user's persistent ZIP archive."""
    return agent_tools.emacs_user_get_file(uid, filepath)


@server.tool(name="emacs_user_list_files")
def tool_list_files(uid: str) -> Dict[str, Any]:
    """List all files and directories in the virtual user's persistent ZIP archive."""
    return agent_tools.emacs_user_list_files(uid)


def main():
    transport = "stdio"
    if "--sse" in sys.argv:
        transport = "sse"
    server.run(transport=transport)


if __name__ == "__main__":
    main()
