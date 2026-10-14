#!/usr/bin/env python3
"""Example showing integration with Google Antigravity SDK agents."""

from emacs_jail.agent_tools import (
    ANTIGRAVITY_TOOLS,
    emacs_org_babel_execute,
    emacs_org_export,
    emacs_org_get_agenda,
    emacs_user_environment_init,
    emacs_user_put_file,
)

# If google-antigravity is installed in your agent environment:
# from google.antigravity import Agent, LocalAgentConfig


def simulate_agent_tool_dispatch():
    print("=== Google Antigravity SDK Agent Tools Interface ===")
    print(f"Available tools for Agent tool-calling ({len(ANTIGRAVITY_TOOLS)} total):")
    for t in ANTIGRAVITY_TOOLS:
        print(f" - {t.__name__}: {t.__doc__.splitlines()[0] if t.__doc__ else ''}")

    tenant_id = "agent_client_007"

    # Step 1: Agent creates a new isolated environment
    print(f"\n1. Agent calls `emacs_user_environment_init(uid='{tenant_id}')`:")
    init_res = emacs_user_environment_init(tenant_id, description="Client workspace for research tasks")
    print("   Result:", init_res["status"], "-> Archive:", init_res["archive_path"])

    # Step 2: Agent uploads an Org-mode project document
    print("\n2. Agent calls `emacs_user_put_file` to write research notes:")
    sample_doc = """#+TITLE: Agent Research Summary
#+AUTHOR: Agentic Worker

* Project Tasks
** TODO Analyze security boundary of Firejail chroot-like sandbox :security:
SCHEDULED: <2026-10-15 Thu>
** DONE Test persistent zip packaging
DEADLINE: <2026-10-13 Tue>

* Data Processing Block
#+begin_src python :results output
data = [10, 20, 30, 40]
print(f"Computed sum: {sum(data)}, average: {sum(data)/len(data)}")
#+end_src
"""
    put_res = emacs_user_put_file(tenant_id, "workspace/research.org", sample_doc)
    print("   Result:", put_res["status"], f"({put_res['bytes_written']} bytes written)")

    # Step 3: Agent executes code blocks in sandbox
    print("\n3. Agent calls `emacs_org_babel_execute` in zero-trust sandbox:")
    b_res = emacs_org_babel_execute(tenant_id, "research.org")
    print("   Result:", b_res["status"], f"(took {b_res['execution_time_seconds']}s)")

    # Step 4: Agent exports to HTML
    print("\n4. Agent calls `emacs_org_export(format='html')`:")
    exp_res = emacs_org_export(tenant_id, "research.org", export_format="html")
    print("   Result:", exp_res["status"], "->", exp_res["output_filename"])

    # Step 5: Agent queries tasks
    print("\n5. Agent calls `emacs_org_get_agenda`:")
    agenda_res = emacs_org_get_agenda(tenant_id, files=["research.org"])
    for item in agenda_res["items"]:
        print(f"   [{item['todo'] or 'HEADING'}] {item['title']} (tags: {item['tags']})")


if __name__ == "__main__":
    simulate_agent_tool_dispatch()
