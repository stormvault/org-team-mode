# Product Definition

## Project Title
**Emacs-Web (Emacs-Jail)**

## Product Vision & Summary
Emacs-Web is a multi-tenant, zero-trust security framework that isolates GNU Emacs and Org-Mode processes inside hardened Firejail sandboxes. The system provides chroot-like, persistent, single-file ZIP archived user environments keyed by virtual user identifiers (UIDs) authenticated through Firebase Authentication Google Sign-In. It empowers web tenants, API clients, and autonomous AI agents orchestrated by the Google Antigravity SDK to safely leverage Emacs execution—specifically Org-Mode document export, Org-Babel code execution, literate programming tangling, and task agenda extraction—without requiring host system accounts or administrative privileges.

## Core Target Audience
1. **Web Applications & SaaS Tenants**: Platforms that need to offer rich Org-Mode document authoring, viewing, and exporting to users without risking host system integrity.
2. **Autonomous AI Agents**: Agents powered by the Google Antigravity SDK executing literate programming workflows, Org-Babel code evaluation, and structured task extraction under strict safety boundaries.
3. **API & MCP Clients**: Applications integrating via the Model Context Protocol (MCP) or FastAPI gateways to run sandboxed Emacs operations on demand.

## Key Capabilities & Features
1. **Virtual User ID (UID) Architecture**
   - Environments indexed by application-level virtual UIDs (e.g. `user_101`, `tenant-alice`, `client_99`) rather than Linux `/etc/passwd` accounts.
   - Complete process, IPC, and filesystem isolation for non-system users without host account provisioning.

2. **Single-File ZIP Archive Persistence**
   - User state encapsulated into a single durable `.zip` archive (`data/users/<uid>.zip` or configurable storage directory).
   - Atomic sync operations using temporary staging archives and `os.replace` to prevent corruption.
   - Built-in Zip-Slip defense validating canonical boundary paths to thwart path traversal exploits.
   - Re-entrant file locking (`ArchiveLock` via `fcntl`) preventing concurrent archive corruption.

3. **Chroot-Like Firejail Sandboxing**
   - Virtual environments mounted as private home directories via Firejail's `--private=<dir>`.
   - Ephemeral `/tmp` runtime directories destroyed upon task completion.
   - Zero-trust network policy (`--net=none`) isolating untrusted execution from LAN and WAN.
   - Strict Linux namespaces (PID, IPC), capability dropping (`--caps.drop=all`), and Seccomp system-call filtering.
   - Fine-grained resource controls (`RLIMIT_CPU`, `RLIMIT_AS`, `RLIMIT_NPROC`, `RLIMIT_FSIZE`) mitigating denial-of-service risks.

4. **Headless Org-Mode Specialization**
   - **Document Export**: Fast headless export of `.org` documents to HTML, Markdown, Plain Text, and LaTeX.
   - **Zero-Trust Org-Babel Execution**: Safe evaluation of code blocks (Python, Emacs Lisp, Shell) inside the sandbox with automated `#+RESULTS:` insertion.
   - **Literate Programming (Tangling)**: Source code extraction directly from Org documents via `org-babel-tangle`.
   - **Structured Agenda & Task Extraction**: Parsing deadlines, scheduled tasks, TODO states, and priorities into native JSON.
   - **Arbitrary Elisp Evaluation**: Evaluation of arbitrary S-expressions safely in batch mode.

5. **Agent & Gateway Integration**
   - **Google Antigravity SDK**: Ready-to-use tool callables (`ANTIGRAVITY_TOOLS`) with declarative safety policies restricting tool execution to verified tenant boundaries.
   - **Model Context Protocol (MCP)**: Native stdio and SSE server exposing Emacs tools to MCP-compatible clients.
   - **FastAPI Gateway**: Firebase Authentication JWT verification validating Google Sign-In tokens and injecting tenant context.
