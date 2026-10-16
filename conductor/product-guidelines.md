# Product Guidelines

## Brand Identity & Tone
- **Security-First & Trustworthy**: The system handles untrusted tenant execution. Every architectural decision, interface, and message must reflect defensive programming and verifiable zero-trust isolation.
- **Precision & Technical Clarity**: Documentation, CLI help, logs, and error messages should be concise, unambiguous, and technically rigorous.
- **Developer-Centric & Power-User Ergonomics**: Deliver intuitive Python APIs, clean CLI interfaces (`emacs-jail`), standardized agent tools, and keyboard-driven Norang GTD workflows that feel effortless to operate.

## UX & Architectural Principles

### 1. Zero-Trust & Least Privilege
- Never trust input: virtual UIDs must conform strictly to safe alphanumeric patterns (`^[a-zA-Z0-9_-]+$`) or RFC 4122 UUIDs.
- Sandboxes default to completely offline (`--net=none`), non-root (`--noroot`), with all Linux capabilities dropped (`--caps.drop=all`).
- Host filesystem paths must never be exposed or accessible within tenant environments.
- Mandatory Firebase Phone MFA enforcement for all sensitive project collaboration and data access routes.

### 2. High-Density Plain-Text GTD UX (Norang Philosophy)
- Every visual field must be filled with actionable or historically actionable data (TODO, NEXT, STARTED, WAITING, HOLD, DONE, CANCELLED).
- Avoid decorative empty whitespace; prioritize high information throughput and instant keyboard navigation (`j`/`k`, single-key state changes, fast template capture).
- Progressive keyboard enrollment: Vocal assistance answers *"Which shortcut should be used to <operation>?"* while teaching physical keyboard chords via interactive Try-Key muscle memory drills.

### 3. Decoupled Control vs Data Plane & Immutable Archiving
- Direct GCS transfers: Never proxy raw `.zip` archive bytes through Cloud Run / App Hosting compute instances.
- Immutable versioning: Name archives by content hash (`config_{hash}.zip`) with `Cache-Control: private, max-age=31536000, immutable`. Never overwrite in place; advance pointers atomically in Firestore.
- Non-disruptive voice HUD: Ephemeral floating card anchored top-right without stealing editor cursor focus or agenda scroll state.

### 4. Hermetic & Ephemeral Sandbox Execution
- Tenant execution occurs strictly inside ephemeral directories allocated in `/tmp`.
- No state survives outside the tenant's single-file archive.
- Submodule synchronization: Headless Emacs runtime strictly compiles and executes against Git submodule `org-mode/` pinned to tag `release_9.7.15`.
- Workspace mutations are committed atomically back to the archive within protected lock boundaries.

### 5. Agent-First Design
- Tool interfaces for AI agents (Google Antigravity SDK, MCP) must provide rich docstrings, explicit type signatures, and deterministic JSON outputs.
- Errors must provide actionable diagnoses without leaking host internal paths or security metadata.

### 6. High-Quality Verification & Testing
- Every security boundary (path traversal, ZIP slip, isolation, concurrency) and UI interaction must be backed by automated unit and integration tests.
- Code changes must adhere to Test-Driven Development (TDD) as detailed in `workflow.md`.
