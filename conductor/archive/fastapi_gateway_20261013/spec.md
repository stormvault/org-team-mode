# Specification: FastAPI Web Gateway with Firebase Authentication & Antigravity Agent Orchestration

## 1. Overview
This track delivers the core MVP web gateway for `emacs-web` in `src/emacs_web/`. It connects external HTTP/WebSocket web clients to the underlying sandboxed Emacs execution engine (`firejail/emacs_jail/`). The service verifies Google Sign-In JWT ID tokens via Firebase Authentication, extracts and sanitizes tenant UIDs, establishes an authenticated tenant context, and orchestrates either direct Firejail Emacs tools or Google Antigravity SDK agents (`google-antigravity`) governed by strict deny-by-default safety policies.

## 2. Functional Requirements

### 2.1 Firebase Authentication & Tenant Injection
- Verify incoming HTTP `Authorization: Bearer <token>` headers against Firebase Authentication using the Firebase Admin SDK.
- Validate tenant UID with strict RFC 4122 UUID and alphanumeric sanitization (`^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]{0,127}$`), rejecting path traversal indicators (`..`, `/`, `\`, `\0`).
- Provide dual-mode authentication: live Google/Firebase token verification in production, with configurable Firebase Auth Emulator / mock token bypass (`TEST_AUTH_OVERRIDE=true` or mock bearer tokens) for automated test suites and local development.
- Inject `AuthenticatedTenant(uid, email, display_name)` dependency into all tenant-scoped routes.

### 2.2 REST API Endpoints
- **Environment Management**:
  - `POST /api/v1/env/init`: Initialize starter environment for tenant (`<storage>/<uid>.zip`).
  - `GET /api/v1/env/status`: Inspect tenant archive metadata and storage metrics.
- **Workspace File Operations**:
  - `GET /api/v1/files`: List files in the tenant's workspace.
  - `GET /api/v1/files/{filepath}`: Retrieve file contents.
  - `PUT /api/v1/files/{filepath}`: Create or update file contents in the tenant's archive.
  - `DELETE /api/v1/files/{filepath}`: Remove file from workspace.
- **Org-Mode Execution**:
  - `POST /api/v1/org/export`: Headless export of `.org` document to HTML, Markdown, LaTeX, or Plain Text.
  - `POST /api/v1/org/babel`: Execute code blocks inside Org document with automated `#+RESULTS:` insertion.
  - `POST /api/v1/org/tangle`: Tangle source code blocks from Org document into workspace files.
  - `GET /api/v1/org/agenda`: Extract deadlines, TODO tasks, and priorities as structured JSON.
  - `POST /api/v1/org/eval`: Batch evaluation of arbitrary Emacs Lisp expressions.

### 2.3 Agent Orchestration & Chat Endpoints
- **Agent Execution**:
  - `POST /api/v1/agent/chat`: Standard synchronous/asynchronous JSON response executing an Antigravity agent turn.
  - `GET /api/v1/agent/chat/stream`: Server-Sent Events (SSE) streaming endpoint delivering real-time thinking tokens and tool execution events.
- **Agent Lifecycle Configuration**:
  - Controlled by configuration key `EMACS_AGENT_PERSISTENCE` (defaulting to `"EPHEMERAL"` request-scoped sessions, with support for `"LONGRUNNING"` resident tenant agent workers).
  - Configures `LocalAgentConfig` with tenant-isolated `app_data_dir` (`<runtime_dir>/agent_brain`) and strict deny-by-default policies: `policy.deny_all()` overridden only by `policy.allow("emacs_*", when=lambda args: args.get("uid") == tenant.uid)`.

### 2.4 Package & Storage Integration
- Configure `pyproject.toml` in repository root to include `emacs-jail` as an editable path dependency (`{ path = "firejail", editable = true }`).
- Configure default storage directory via `EMACS_JAIL_STORAGE_DIR`, defaulting to `<root>/data/users/`.

## 3. Non-Functional Requirements
- **Security**: No host directory escape; all Emacs processes run inside Firejail with `--private`, `--net=none`, seccomp, and capability dropping.
- **Concurrency**: Tenant archive mutations guarded by `ArchiveLock` (`fcntl.flock`) preventing multi-process race conditions.
- **Reliability & TDD**: Unit and integration test suite with >80% code coverage.
- **Performance**: Cold start overhead for API requests <100ms when utilizing static Emacs pdmp.

## 4. Acceptance Criteria
1. FastAPI app starts cleanly with `uvicorn emacs_web.app:app` or CLI `emacs-web`.
2. Valid Firebase JWT authenticates and correctly isolates requests to the tenant's `<uid>.zip`.
3. Inauthentic or forged tokens receive HTTP 401 Unauthorized; malformed UIDs receive HTTP 400 Bad Request.
4. Org export, babel execution, tangling, and agenda parsing succeed through HTTP endpoints and reflect in the persisted tenant archive.
5. `/api/v1/agent/chat` and `/api/v1/agent/chat/stream` orchestrate Antigravity agent tool calls within tenant security policies.
6. Test suite in `tests/` passes with 100% success rate under `uv run pytest`.

## 5. Out of Scope
- Frontend GUI web application (React/Vue/Svelte client - handled in a future track).
- Live cloud deployment to Google Cloud Run / Firebase App Hosting (handled in deployment track).
