# Emacs-Jail: Multi-Tenant Zero-Trust Firejail Framework for Emacs & Org-Mode

A high-performance security framework that isolates GNU Emacs processes inside hardened **Firejail** sandboxes. It provides **chroot-like, long-lasting, single-file ZIP archived user environments** keyed by virtual user identifiers (**UIDs**), allowing multiple non-system users (e.g. web tenants, API clients, AI agents) to securely utilize Emacs execution—specifically **Org-Mode**.

---

## Key Features

1. **Virtual User ID (UID) Architecture**
   - Environments are indexed by application-level virtual UIDs (e.g. `user_101`, `tenant-alice`, `client_99`) rather than Linux `/etc/passwd` accounts.
   - Non-system users enjoy complete process, IPC, and filesystem isolation without requiring host system accounts or administrative privileges.

2. **Single-File ZIP Archive Persistence**
   - Each virtual user's state is encapsulated into a single durable `.zip` archive (e.g. `storage/<uid>.zip`).
   - Atomic sync operations guarantee durability: updates are written to temporary staging archives and atomically replaced (`os.replace`) to prevent corruption.
   - Built-in Zip-Slip defense verifies canonical boundaries to thwart path traversal exploits.

3. **Chroot-Like Firejail Sandboxing**
   - Virtual environments are mounted as the private home directory via Firejail's `--private=<dir>`.
   - Host filesystem paths (SSH keys, developer repositories, system configs) are completely hidden and unmapped.
   - Zero-trust network policy (`--net=none` default) isolates untrusted documents from LAN and WAN.
   - Strict Linux namespaces (PID, IPC), capability dropping (`--caps.drop=all`), and seccomp system-call filtering.
   - Fine-grained resource controls (`RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_NPROC`, `RLIMIT_FSIZE`) mitigate fork bombs, runaway loops, and memory exhaustion.

4. **Org-Mode Specialization**
   - **Headless Document Export**: Fast export of `.org` files to HTML, Markdown, Plain Text, and LaTeX.
   - **Zero-Trust Org-Babel Execution**: Safely evaluate code blocks (Python, Emacs Lisp, Shell) inside the sandbox with automated `#+RESULTS:` insertion.
   - **Literate Programming (Tangling)**: Extract runnable source files directly from Org documents (`org-babel-tangle`).
   - **Structured Agenda & Task Extraction**: Extract deadlines, scheduled tasks, TODO states, and priorities into native JSON.
   - **Arbitrary Elisp Evaluation**: Evaluate arbitrary S-expressions safely in batch mode.

5. **Multi-Tenant Concurrency & Locking**
   - Re-entrant file locking (`ArchiveLock`) prevents race conditions during concurrent access to the same virtual user archive.

6. **Google Antigravity SDK & MCP Integration**
   - Provides native Python tool call signatures (`ANTIGRAVITY_TOOLS`) ready for Google Antigravity SDK agents (`LocalAgentConfig`).
   - Includes a full Model Context Protocol (MCP) server (`emacs-jail-mcp`) communicating over stdio or SSE.

---

## Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            Host Application / AI Agent                            |
|             (CLI `emacs-jail`, Python API, or Google Antigravity SDK)             |
+-----------------------------------------+-----------------------------------------+
                                          |
                      +-------------------+-------------------+
                      |   Virtual User UID Validation & Lock  |
                      |          <storage_dir>/<uid>.lock     |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |         User Archive Manager          |
                      |  Reads / Unpacks <storage_dir>/<uid>.zip
                      |       (Zip-Slip Boundary Checks)      |
                      +-------------------+-------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |       Ephemeral Runtime Directory     |
                      |      /tmp/emacs_jail_run/<uid>_<id>   |
                      |  ├── .emacs.d/init.el                 |
                      |  ├── workspace/ (org files, assets)   |
                      |  └── .emacs_jail/lisp/ (helpers)      |
                      +-------------------+-------------------+
                                          |
                                          v
  +-------------------------------------------------------------------------------+
  |                          Firejail Zero-Trust Sandbox                          |
  |                                                                               |
  |  • --private=<runtime_dir> (mounts runtime dir as virtual $HOME)              |
  |  • --private-tmp, --private-dev, --private-etc                                |
  |  • --caps.drop=all, --seccomp, --noroot, --ipc-namespace                      |
  |  • --net=none (Offline zero-trust, no network leaks)                          |
  |  • RLIMITs: CPU (60s), RAM (1GB), NPROC (128), FSIZE (100MB)                  |
  |                                                                               |
  |  +-------------------------------------------------------------------------+  |
  |  |                         GNU Emacs Process                               |  |
  |  |   - Org Export (HTML, Markdown, LaTeX)                                  |  |
  |  |   - Org-Babel execution (Python, Elisp, Bash)                           |  |
  |  |   - Org-Babel tangling (Source extraction)                              |  |
  |  |   - Org Agenda / TODO parsing -> Native JSON output                     |  |
  |  +-------------------------------------------------------------------------+  |
  +-------------------------------------------------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |         Atomic Repack & Commit        |
                      |  Packs modified workspace back into   |
                      |     <storage_dir>/<uid>.zip (atomic)  |
                      |  Destroys ephemeral runtime directory |
                      +---------------------------------------+
```

---

## Directory Structure

```
emacs-web/
├── firejail/
│   ├── emacs-org.profile       # Production profile for Emacs + Org-mode
│   ├── emacs-strict.profile    # Pure Elisp offline profile (no external shells)
│   └── emacs-network.profile   # Controlled network profile (optional)
├── emacs_jail/
│   ├── __init__.py             # Public exports
│   ├── config.py               # Configuration management and path resolution
│   ├── archive.py              # ZIP archive management, Zip-Slip defense, locking
│   ├── sandbox.py              # Firejail execution engine and command assembly
│   ├── user_env.py             # UserEnvironment lifecycle context manager
│   ├── emacs.py                # High-level Org-Mode operations engine
│   ├── cli.py                  # Full-featured `emacs-jail` CLI
│   ├── agent_tools.py          # Google Antigravity SDK tool integrations
│   └── mcp_server.py           # Model Context Protocol stdio/SSE server
├── lisp/
│   ├── org-export-runner.el    # Headless batch exporter
│   ├── org-babel-runner.el     # Safe batch Babel code runner & tangler
│   └── org-agenda-runner.el    # AST parser outputting native JSON agenda data
├── tests/
│   ├── test_archive.py         # Unit tests for ZIP operations and Zip-Slip
│   ├── test_user_env.py        # Unit tests for session lifecycle and paths
│   ├── test_sandbox.py         # Unit tests for Firejail commands
│   └── test_emacs_org.py       # Integration tests in live Firejail sandboxes
├── examples/
│   ├── basic_usage.py          # General Python API walkthrough
│   ├── multi_tenant_demo.py    # Concurrency test across multiple UIDs
│   ├── babel_workflow.py       # Literate programming and code tangling
│   └── antigravity_agent_example.py # AI agent tool dispatch demo
├── pyproject.toml              # Build & installation metadata
└── README.md
```

---

## Quickstart

### 1. Installation

Install the framework into your Python environment:

```bash
cd /home/self/git/emacs-web
pip install -e .
```

Verify the installation:

```bash
emacs-jail --help
```

---

## CLI Usage Guide

### Initialize User Environments
Initialize an isolated single-file archive for a non-system user UID:

```bash
emacs-jail init tenant_101
```

List all registered user environments and storage metrics:

```bash
emacs-jail list-users
```

Inspect user environment metadata:

```bash
emacs-jail info tenant_101
```

### Org-Mode Export
Export a document inside the user's workspace to HTML or Markdown:

```bash
# Export to HTML
emacs-jail export tenant_101 notes.org --format html --output notes.html

# Export to Markdown
emacs-jail export tenant_101 notes.org --format md --output notes.md --print
```

### Org-Babel Code Execution & Tangling
Execute code blocks in an Org document in a zero-trust sandbox:

```bash
emacs-jail babel tenant_101 notes.org
```

Tangle (extract) source code blocks from a literate Org file:

```bash
emacs-jail babel tenant_101 notes.org --tangle
```

### Structured Agenda & Task Extraction
Extract TODO items, priorities, deadlines, and schedules:

```bash
# Formatted table output
emacs-jail agenda tenant_101

# Raw JSON output
emacs-jail agenda tenant_101 --json
```

### File Management Inside the Single-File ZIP
Inspect, upload, or download files from the user's single-file archive:

```bash
# List files in user archive
emacs-jail file ls tenant_101

# Upload a local file into the user's workspace
emacs-jail file put tenant_101 ./my_notes.org workspace/my_notes.org

# Print file content from archive
emacs-jail file cat tenant_101 workspace/notes.html

# Download file from archive to host
emacs-jail file get tenant_101 workspace/notes.html ./local_notes.html
```

### Elisp Evaluation & Interactive Sessions
Evaluate arbitrary Emacs Lisp inside the sandbox:

```bash
emacs-jail eval tenant_101 "(org-version)"
```

Launch an interactive terminal Emacs session inside the isolated user environment:

```bash
emacs-jail run tenant_101 -nw
```

---

## Python API Usage

```python
from emacs_jail import EmacsOrgManager, UserArchiveManager, UserEnvironment

emacs = EmacsOrgManager()
archive_mgr = UserArchiveManager()

uid = "web_user_500"

# 1. Initialize environment
archive_mgr.create_initial_archive(uid)

# 2. Add or update files directly in user archive
archive_mgr.write_file(
    uid,
    "workspace/project.org",
    """#+TITLE: Project Plan
* TODO [#A] Deploy sandbox :devops:
SCHEDULED: <2026-10-20 Tue>
#+begin_src python :results output
print(f"2 + 2 = {2 + 2}")
#+end_src
""",
)

# 3. Execute Babel code blocks in sandbox
b_res = emacs.babel_execute(uid, "project.org")
print("Babel output:\n", b_res.content)

# 4. Export to HTML
html_res = emacs.export(uid, "project.org", export_format="html")
print(f"Exported to {html_res.output_filename} in {html_res.execution_time}s")

# 5. Extract structured agenda
tasks = emacs.get_agenda(uid)
for task in tasks:
    print(f"Task: {task['title']} | State: {task['todo']} | Scheduled: {task['scheduled']}")

# 6. Low-level context manager for custom session runs
with UserEnvironment(uid, readonly=False) as env:
    # Run arbitrary custom emacs batch command
    result = env.run_emacs(["-Q", "--batch", "--eval", '(message "Custom batch run")'])
    print(result.stdout)
    # State is automatically committed to <uid>.zip upon exit
```

---

## Google Antigravity SDK & Agent Tools Integration

The framework exports ready-to-use tool callables for AI agents built with the **Google Antigravity SDK** (`google-antigravity`):

```python
from emacs_jail.agent_tools import (
    ANTIGRAVITY_TOOLS,
    emacs_user_environment_init,
    emacs_org_export,
    emacs_org_babel_execute,
    emacs_org_get_agenda,
    emacs_eval_elisp,
    emacs_user_put_file,
    emacs_user_get_file,
    emacs_user_list_files,
)

# When configuring a Google Antigravity agent:
# from google.antigravity import Agent, LocalAgentConfig
#
# agent = Agent(
#     LocalAgentConfig(
#         tools=ANTIGRAVITY_TOOLS,
#         system_instruction="You are an assistant capable of running isolated Org-mode tasks for tenants.",
#     )
# )
```

### Running the Model Context Protocol (MCP) Server

To expose the sandboxed Emacs tools to any MCP-compatible agent or client:

```bash
# Stdio transport (default)
emacs-jail-mcp

# SSE transport (for web/remote agents)
emacs-jail-mcp --sse
```

---

## Running the Verification Test Suite

Run the full pytest suite (14 unit & integration tests):

```bash
pytest -v tests/
```

Results verify:
- Virtual UID validation and traversal rejection
- Zip-Slip security vulnerability defense
- Re-entrant file locking and concurrency control
- Real Firejail sandboxed Emacs execution
- Org HTML and Markdown export
- Org-Babel code execution and tangling
- JSON agenda and task extraction
- Cross-tenant multi-user filesystem isolation
