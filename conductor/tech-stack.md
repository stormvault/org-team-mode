# Technology Stack

## Core Language & Runtime
- **Language**: Python 3.12+
- **Package & Environment Management**: `uv` / `pyproject.toml`
- **Typing**: Python static typing (`typing`, `mypy`)

## Sandboxing & Host Isolation
- **Sandbox Engine**: Firejail (`/usr/bin/firejail`)
- **Isolation Profiles**:
  - `firejail/emacs-org.profile` (Production profile with Org-Mode support)
  - `firejail/emacs-strict.profile` (Strict offline Elisp-only execution)
  - `firejail/emacs-network.profile` (Controlled network profile if needed)
- **Linux Security Controls**:
  - User namespaces and private directories (`--private=<dir>`, `--private-tmp`, `--private-dev`, `--private-etc`)
  - Linux capability dropping (`--caps.drop=all`, `--noroot`, `--ipc-namespace`)
  - Seccomp system-call filtering
  - Network isolation (`--net=none`)
  - POSIX Resource Limits (`RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_NPROC`, `RLIMIT_FSIZE`)

## Repository Architecture
- **Web Application / Gateway**: `src/emacs_web/` (`pyproject.toml` top-level package managed by `uv`)
- **Sandboxed Execution Subsystem**: `firejail/` containing:
  - Python engine: `firejail/emacs_jail/`
  - Sandboxing profiles: `firejail/emacs-*.profile`
  - Lisp runner scripts: `firejail/lisp/`
  - Tenant archive storage: `firejail/data/users/`
  - Subsystem test suite: `firejail/tests/`

## Execution Engine
- **GNU Emacs**: Headless batch mode (`emacs -Q --batch`)
- **Org-Mode Framework**:
  - Exporters: `ox-html`, `ox-md`, `ox-latex`, `ox-ascii`
  - Babel Code Execution: `org-babel` (supporting Python, Emacs Lisp, Shell)
  - Literate Tangling: `org-babel-tangle`
  - Agenda: Org-Mode AST parsing into structured JSON
- **Lisp Runner Scripts**:
  - `firejail/lisp/org-export-runner.el`
  - `firejail/lisp/org-babel-runner.el`
  - `firejail/lisp/org-agenda-runner.el`

## Agent & Client Protocols
- **AI Agent SDK**: Google Antigravity SDK (`google-antigravity`)
- **Tool Protocol**: Model Context Protocol (MCP) Python SDK
- **Web API**: FastAPI, Uvicorn, Pydantic
- **Authentication**: Firebase Authentication (Google Sign-In, Firebase JWT ID tokens)

## Storage & Concurrency
- **Packaging Model**: Single-file ZIP archive (`<uid>.zip`) per virtual tenant
- **Concurrency Control**: Re-entrant file locking (`ArchiveLock` using `fcntl.flock`)
- **Durability**: Atomic staging and replacement (`os.replace`)
- **Exploit Mitigation**: Zip-Slip defense verifying path normalization within the target boundary

## Testing & Quality Assurance
- **Test Framework**: `pytest`, `pytest-cov`, `pytest-asyncio`
- **Linting & Formatting**: `ruff`
