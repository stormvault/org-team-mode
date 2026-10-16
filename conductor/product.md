# Product Definition

## Project Title
**Emacs-Web & HabitFlow Org PWA (Full-Stack Zero-Trust Org-Mode Ecosystem)**

## Product Vision & Summary
Emacs-Web & HabitFlow Org is a unified full-stack productivity ecosystem uniting a high-density, keyboard- and voice-driven Angular 22 Progressive Web Application (HabitFlow Org) with a zero-trust, multi-tenant Firejail-sandboxed GNU Emacs execution gateway (Emacs-Jail). The frontend provides a client-side Plain-Text GTD engine with sub-daily interval countdown timers, daily streaks, 5-block agenda, and a Web Speech API Head-Up Display (HUD) with progressive keyboard enrollment drills, while maintaining full connectivity to the backend Emacs-Jail environment to execute the complete, authentic Norang feature set (document publishing, clock reports, agenda parsing, Babel literate programming). The backend execution environment strictly pins, installs, and configures GNU Org-Mode using the exact version tag specified by Bernt Hansen's canonical document (version 9.7.15, checked out via the submodule at `@org-mode/`), ensuring 100% feature and configuration parity. Tenant workspaces are encapsulated into immutable, versioned single-file ZIP archives stored on Cloud Storage for Firebase (GCS) with atomic Firestore pointer updates, decoupled from the compute plane to eliminate Cloud Run byte-proxy bottlenecks, and gated by Firebase Authentication with mandatory Phone MFA linking.

## Core Target Audience
1. **GTD & Org-Mode Power Users**: Professionals demanding authentic Plain-Text GTD discipline (Norang state machine, clocking vs effort, stuck project detection) accessible across desktop and mobile without physical keyboard limitations.
2. **Collaborative Teams**: Distributed teams needing real-time collaborative workspace synchronization for shared Org-Mode project files protected by zero-trust identity and Phone MFA.
3. **Autonomous AI Agents**: Agents powered by the Google Antigravity SDK executing literate programming workflows, Org-Babel code blocks, and structured task extraction under strict process and filesystem boundaries.
4. **API & MCP Consumers**: Enterprise and client applications querying headless GNU Emacs via REST API or the Model Context Protocol (MCP).

## Key Capabilities & Features

### 1. High-Density Keyboard- & Voice-Driven Frontend (HabitFlow Org)
- **Norang GTD 7-State Engine**: Deterministic task lifecycle (TODO -> NEXT -> STARTED -> WAITING -> HOLD -> DONE -> CANCELLED) with fast single-key transitions.
- **Habits & Sub-Daily Intervals**: Precision interval countdown timers with configurable Tone.js chime packs, quiet hours schedule, daily streak tallies, and bidirectional Org-mode scheduled repeater advances.
- **Canonical 5-Block Agenda**: Live Schedule, NEXT actions, Stuck projects (missing NEXT steps), Waiting tasks, and Historical Done archives.
- **Web Speech API Voice Assistant & HUD**: Ephemeral floating Head-Up Display answering *"Which keyboard shortcut should be used to <operation>?"* with interactive Try-Key muscle memory drills, configurable speech rate/pitch, and zero cursor/scroll disruption.
- **Full Backend Emacs-Jail Feature Access**: Seamlessly offloads heavy Org operations (publishing, clock summaries, Babel literate code evaluation, tangling) to the backend Emacs execution service.
- **Full Team Cloud Sync & Optimistic Local-First**: Real-time collaborative workspace synchronization via Firebase snapshot listeners with offline IndexedDB storage and automatic conflict resolution.
- **Phone MFA Account Linking**: Strict navigation and project access gating requiring verified Firebase Phone MFA.

### 2. Cloud Storage for Firebase & Immutable Versioned Archive Storage
- **Decoupled Control & Data Planes**: Cloud Run / App Hosting handles authentication and metadata only; raw binary transfers never proxy through backend containers.
- **Immutable Content-Addressed ZIP Archiving**: Archives stored at `gs://<bucket>/users/{uid}/configs/{version_hash}.zip` with `Cache-Control: private, max-age=31536000, immutable`. In-place overwrites are strictly forbidden; updates atomically advance the version pointer in Firestore.
- **Dual Transfer Patterns**:
  - **Pattern A (Client-Direct)**: Browser client transfers directly to GCS edge via Firebase Storage Client SDK with granular security rules:
    `allow read, write: if request.auth != null && request.auth.uid == userId;`
  - **Pattern B (Server-Brokered via V4 Signed URLs)**: App Hosting generates short-lived V4 Signed URLs (5–15 min TTL) using keyless `roles/iam.serviceAccountTokenCreator` on the Cloud Run runtime service account.
- **Production Storage Disciplines**: Explicit `Content-Type: application/zip` without double gzip compression (preserving HTTP range requests); GCS object lifecycle policies automatically prune older versions.

### 3. Canonical Org-Mode 9.7.15 Submodule Integration (@org-mode/)
- **Strict Version Pinning**: Tracks Git submodule `org-mode/` at tag `release_9.7.15` conforming to `https://doc.norang.ca/org-mode.html#ChangeHistory`.
- **Norang Getting Started Configuration**: Automated compilation and loading of Org-Mode 9.7.15 into the headless Emacs runtime following Norang setup instructions.

### 4. Zero-Trust Multi-Tenant Backend (Emacs-Jail & Gateway)
- **Virtual UID Architecture**: Workspaces indexed by Firebase Authentication UIDs, isolating processes and filesystem trees without host account provisioning.
- **Chroot-Like Firejail Sandboxing**: Private home mounts, ephemeral `/tmp`, capability dropping, Seccomp syscall filtering, network isolation, and POSIX resource caps.
- **Headless GNU Emacs Batch Runners**: Automated document export (HTML, MD, LaTeX), Babel evaluation, and AST agenda extraction into JSON using Org-Mode 9.7.15.
- **Google Antigravity Agent & MCP Server**: Declarative agent tools (`ANTIGRAVITY_TOOLS`) and native MCP stdio/SSE server exposing Emacs capabilities to autonomous agents.

## Deployment Topology
- **Frontend PWA**: Hosted on Firebase App Hosting with Service Worker caching and PWA installability.
- **Backend Services**: FastAPI Web Gateway and Firejail sandbox deployed in containerized hosts (Cloud Run / GKE / secure VM instances).
