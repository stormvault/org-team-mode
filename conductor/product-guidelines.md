# Product Guidelines

## Brand Identity & Tone
- **Security-First & Trustworthy**: The system handles untrusted tenant execution. Every architectural decision, interface, and message must reflect defensive programming and verifiable zero-trust isolation.
- **Precision & Technical Clarity**: Documentation, CLI help, logs, and error messages should be concise, unambiguous, and technically rigorous.
- **Developer-Centric Ergonomics**: Deliver intuitive Python APIs, clean CLI interfaces (`emacs-jail`), and standardized agent tools that feel effortless to integrate.

## UX & Architectural Principles

### 1. Zero-Trust & Least Privilege
- Never trust input: virtual UIDs must conform strictly to safe alphanumeric patterns (`^[a-zA-Z0-9_-]+$`) or RFC 4122 UUIDs.
- Sandboxes default to completely offline (`--net=none`), non-root (`--noroot`), with all Linux capabilities dropped (`--caps.drop=all`).
- Host filesystem paths must never be exposed or accessible within tenant environments.

### 2. Hermetic & Ephemeral Execution
- Tenant execution occurs strictly inside ephemeral directories allocated in `/tmp`.
- No state survives outside the tenant's single-file archive.
- Workspace mutations are committed atomically back to the archive (`os.replace`) within protected lock boundaries. If execution fails or aborts, staging changes are cleanly rolled back.

### 3. Agent-First Design
- Tool interfaces for AI agents (Google Antigravity SDK, MCP) must provide rich docstrings, explicit type signatures, and deterministic JSON outputs.
- Errors must provide actionable diagnoses (e.g. `OrgModeError`, `ZipSlipError`, `SandboxTimeoutError`) without leaking host internal paths or security metadata.

### 4. High-Quality Verification & Testing
- Every security boundary (path traversal, ZIP slip, isolation, concurrency) must be backed by automated unit and integration tests.
- Code changes must adhere to Test-Driven Development (TDD) as detailed in `workflow.md`.
