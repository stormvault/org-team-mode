# Emacs-web: sandboxed Emacs execution gateway

Emacs-web is a multi-tenant web application and execution framework that runs GNU Emacs and Org-mode operations inside hardened Firejail sandboxes. The service authenticates web users through Firebase Authentication (Google Sign-In), maps requests to virtual user identifiers (UIDs), and persists user workspaces in isolated single-file ZIP archives. It provides a FastAPI REST interface and integrates with the Google Antigravity SDK (`google-antigravity`) for autonomous AI agent workflows.

---

## Architecture overview

The system separates incoming web requests from privileged host operations across three main layers:

1. Web gateway and authentication layer (`src/emacs_web`): A FastAPI service that validates Firebase JWT ID tokens, checks tenant UIDs against path traversal attempts, and injects authenticated user context into route handlers.
2. Sandboxed execution engine (`firejail/emacs_jail`): A process isolation library that invokes GNU Emacs batch operations within Linux mount, network, PID, and IPC namespaces using Firejail.
3. Agent orchestration layer: An agent runner using the Google Antigravity SDK (`LocalAgentConfig`) configured with deny-by-default safety policies, isolated agent storage directories, and Server-Sent Events (SSE) streaming.

```
+-----------------------------------------------------------------------------------+
|                           Web Client (Google Sign-In)                             |
|                   Obtains Firebase JWT ID Token (contains UID)                    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTPS / WebSocket (Bearer JWT)
                                          v
+-----------------------------------------------------------------------------------+
|                         FastAPI Gateway (src/emacs_web)                           |
|          * Verifies Firebase JWT via Admin SDK / public keys                      |
|          * Validates UID format (RFC 4122 UUID and alphanumeric sanitization)     |
|          * Injects authenticated tenant context: AuthenticatedTenant(uid)         |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Authenticated request + user context
                                          v
+-----------------------------------------------------------------------------------+
|                 Google Antigravity SDK Agent Orchestration Layer                  |
|          * LocalAgentConfig with isolated app_data_dir per tenant                 |
|          * Deny-by-default safety policy: policy.deny_all()                       |
|          * Per-tool tenant authorization matching target UID                      |
|          * Tools: export, babel_execute, tangle, get_agenda, eval_elisp          |
+-----------------------------------------+-----------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+---------------------------------------+   +---------------------------------------+
|        User archive manager           |   |       Archive concurrency lock        |
|  * Reads and writes <storage>/<uid>.zip|  |   fcntl.flock on <uid>.lock           |
|  * Enforces canonical boundary checks |   |   Prevents concurrent race conditions |
|  * Atomic repack (.tmp -> os.replace) |   +---------------------------------------+
+-------------------+-------------------+
                    |
                    | Unpacks into ephemeral runtime directory
                    v
+-----------------------------------------------------------------------------------+
|      Ephemeral runtime directory (/tmp/emacs_jail_run/user_<uid>_<session_id>)    |
|      |-- .jail_metadata.json          (Tenant schema, timestamps, hashes)         |
|      |-- .emacs.d/init.el             (User initialization file)                  |
|      |-- .emacs_jail/                                                             |
|      |   |-- bin/emacs                (Statically compiled GNU Emacs binary)      |
|      |   |-- bin/emacs.pdmp           (Portable dump file)                        |
|      |   `-- lisp/                    (Headless batch runner scripts)             |
|      `-- workspace/                   (User documents: notes.org, data files)     |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Firejail invocation (--private=<dir>)
                                          v
+-----------------------------------------------------------------------------------+
|                           Firejail zero-trust sandbox                             |
|                                                                                   |
|  * Namespaces: Mount, PID, IPC, Network (--net=none)                              |
|  * Security: caps.drop all, seccomp, noroot, nonewprivs, nosound, novideo         |
|  * Resource limits: CPU (60s), RAM (1GB), NPROC (128), FSIZE (100MB)              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 Hermetic static GNU Emacs process                           |  |
|  |   Executes batch Elisp commands using bundled .emacs_jail/bin/emacs         |  |
|  |   Falls back to host emacs binary if static binary is not present           |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## Core capabilities

### Virtual user environments
Environments are indexed by application-level virtual UIDs (such as `user_101` or `google_oauth2_108293847291039847123`) rather than host `/etc/passwd` accounts. Tenants operate with isolated storage, process trees, and runtime directories without host account creation.

### Single-file archive storage
Every tenant's state resides in a single ZIP file at `data/users/<uid>.zip`. Updates unpack into a temporary `/tmp` directory, execute within the sandbox, and repack atomically via `os.replace` to prevent partial writes. Extraction checks canonical path boundaries to block Zip-Slip path traversal.

### Firejail process isolation
Executions mount the user's ephemeral directory as a virtual `$HOME` using `--private`. Host directories (`/home`, `/root`, `/etc`) are unmapped or read-only. Sandboxes drop all Linux capabilities (`caps.drop all`), apply Seccomp system-call filtering, enable IPC namespaces, and run without network access (`--net=none`).

### Headless Org-mode tools
Batch runners handle common Org-mode tasks without GUI dependencies:
* Document export: Headless conversion to HTML, Markdown, LaTeX, and plain text.
* Org-Babel code execution: Safe execution of Python, Emacs Lisp, and shell code blocks with automated `#+RESULTS:` insertion.
* Source tangling: Extraction of runnable source files from literate Org documents.
* Agenda parsing: Extraction of deadlines, scheduled tasks, TODO states, and priorities as structured JSON.

### Google Antigravity SDK integration
AI agents interact with tenant workspaces through verified tool calls. Tenant agent configurations isolate agent scratch directories (`app_data_dir`) and enforce deny-by-default policies where all unapproved host tools are blocked, and registered Emacs tools require matching tenant IDs.

---

## Repository layout

```
emacs-web/
|-- src/
|   `-- emacs_web/                  # FastAPI application and gateway
|       |-- app.py                  # Application entry point and CLI runner
|       |-- config.py               # Pydantic settings and environment variables
|       |-- auth/                   # Firebase authentication and UID validation
|       |-- agent/                  # Antigravity SDK factory and streaming logic
|       `-- routers/                # REST API endpoints (env, files, org, agent)
|-- firejail/                       # Execution engine and sandbox subsystem
|   |-- emacs_jail/                 # Core Python sandboxing package
|   |   |-- archive.py              # ZIP packaging, locking, and Zip-Slip checks
|   |   |-- sandbox.py              # Firejail command builder and supervisor
|   |   |-- emacs.py                # High-level Org-mode operations
|   |   `-- agent_tools.py          # Callable tool signatures for agents
|   |-- lisp/                       # Batch runner Elisp scripts
|   |-- firejail/                   # Security profiles (*.profile)
|   `-- tests/                      # Engine unit and integration tests
|-- @docs/
|   `-- architecture.md             # Complete system architectural specification
|-- conductor/                      # Spec-Driven Development (SDD) records
|-- tests/                          # Web gateway and API test suite
`-- pyproject.toml                  # Python package configuration (uv workspace)
```

---

## Installation and setup

### Prerequisites
* Linux with kernel namespace support
* Firejail (`sudo apt-get install firejail` or distribution package)
* GNU Emacs 28+ (for host fallback)
* Python 3.12+
* `uv` package manager

### Environment configuration
Create a `.env` file or export environment variables:

```bash
# Authentication settings
TEST_AUTH_OVERRIDE=true            # Enable mock token bypass for local development
FIREBASE_PROJECT_ID=emacs-web      # Firebase project ID for production token checks

# Storage and agent settings
EMACS_JAIL_STORAGE_DIR=data/users  # Path for user ZIP archives
EMACS_AGENT_PERSISTENCE=EPHEMERAL  # EPHEMERAL (request-scoped) or LONGRUNNING
```

### Dependency installation
Install project dependencies with `uv`:

```bash
uv sync
```

---

## Running the application

### Starting the API server
Run the server using the packaged CLI or `uvicorn`:

```bash
# Using the CLI
uv run emacs-web --host 0.0.0.0 --port 8000

# Using uvicorn directly
uv run uvicorn emacs_web.app:app --host 0.0.0.0 --port 8000 --reload
```

---

## API usage examples

All tenant routes require an `Authorization: Bearer <token>` header containing a Firebase JWT ID token (or mock token when `TEST_AUTH_OVERRIDE=true`).

### 1. Initialize user environment
```bash
curl -X POST http://localhost:8000/api/v1/env/init \
  -H "Authorization: Bearer mock_user_101" \
  -H "Content-Type: application/json" \
  -d '{"description": "Personal workspace"}'
```

### 2. Upload an Org-mode document
```bash
curl -X PUT http://localhost:8000/api/v1/files/workspace/notes.org \
  -H "Authorization: Bearer mock_user_101" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "* Project Tasks\n** TODO Write documentation\nDEADLINE: <2026-10-20>\n"
  }'
```

### 3. Export document to HTML
```bash
curl -X POST http://localhost:8000/api/v1/org/export \
  -H "Authorization: Bearer mock_user_101" \
  -H "Content-Type: application/json" \
  -d '{
    "org_file": "notes.org",
    "export_format": "html"
  }'
```

### 4. Query agenda tasks as JSON
```bash
curl -X GET "http://localhost:8000/api/v1/org/agenda?files=notes.org" \
  -H "Authorization: Bearer mock_user_101"
```

### 5. Chat with the Antigravity agent
```bash
# Synchronous JSON response
curl -X POST http://localhost:8000/api/v1/agent/chat \
  -H "Authorization: Bearer mock_user_101" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Export my notes.org file to HTML and summarize any pending TODO items."}'

# Real-time SSE streaming
curl -N http://localhost:8000/api/v1/agent/chat/stream?prompt=Summarize+tasks \
  -H "Authorization: Bearer mock_user_101"
```

---

## Testing and verification

Run the complete test suite from the repository root:

```bash
# Run web gateway tests with coverage report
uv run pytest --cov=emacs_web tests/

# Run Firejail engine tests
uv run pytest firejail/tests/

# Check code formatting and style
uv run ruff check
uv run ruff format --check
```
