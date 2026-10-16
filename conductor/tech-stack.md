# Technology Stack

## 1. Frontend Architecture (HabitFlow Org PWA)
- **Framework**: Angular 22+ (Standalone Components, Signals, Zoneless change detection)
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS, PostCSS, Glassmorphism backdrop filters
- **Audio Synthesis**: Tone.js (Web Audio API for interval chimes and harmonic cues)
- **Voice & Speech Interface**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition` & `SpeechSynthesis`)
- **Offline & Storage**: Progressive Web App (PWA) Service Worker, Web App Manifest, IndexedDB (optimistic local-first), LocalStorage
- **Authentication & Security**: Firebase Auth Web SDK (Google Sign-In, Email/Password, mandatory Phone MFA account linking)
- **Testing**: Vitest (`@analogjs/vitest-angular`), jsdom, automated component and service test suites

## 2. Backend & Gateway Subsystem (Emacs-Web)
- **Language & Runtime**: Python 3.12+ (managed with `uv` and `pyproject.toml`)
- **API Framework**: FastAPI, Starlette, Uvicorn, Pydantic v2
- **Authentication**: Firebase Admin SDK (JWT validation, tenant UID extraction, Phone MFA claims)
- **Agent Integration**: Google Antigravity SDK (`google-antigravity`), Model Context Protocol (MCP) Python SDK
- **Testing**: `pytest`, `pytest-cov`, `pytest-asyncio`

## 3. Sandboxing & Process Isolation Subsystem (Emacs-Jail)
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

## 4. Headless GNU Emacs & Canonical Org-Mode Submodule
- **GNU Emacs**: Headless batch mode (`emacs -Q --batch`)
- **Org-Mode Framework**: Tracked Git submodule at `@org-mode/` strictly pinned to tag `release_9.7.15` conforming to `https://doc.norang.ca/org-mode.html#ChangeHistory`
  - Automated compilation and runtime loading following Norang Getting Started instructions
  - Exporters: `ox-html`, `ox-md`, `ox-latex`, `ox-ascii`
  - Babel Code Execution: `org-babel` (Python, Emacs Lisp, Shell)
  - Literate Tangling: `org-babel-tangle`
  - Agenda: Org-Mode AST parsing into structured JSON
- **Lisp Runner Scripts**:
  - `firejail/lisp/org-export-runner.el`
  - `firejail/lisp/org-babel-runner.el`
  - `firejail/lisp/org-agenda-runner.el`
  - `firejail/lisp/setup-org-mode.el`

## 5. Storage & Archive Data Plane
- **Object Storage**: Cloud Storage for Firebase (GCS)
- **Storage Layout**: `gs://<bucket>/users/{uid}/configs/{version_hash}.zip`
- **Caching & Immutability**: `Cache-Control: private, max-age=31536000, immutable`
- **Data vs Control Plane**: Direct GCS streaming via Firebase Storage Client SDK or V4 Signed URLs; zero raw byte proxying through Cloud Run containers
- **Metadata & Pointers**: Cloud Firestore for structured tenant state, active version pointers, and project collaboration membership
- **Exploit Defenses**: Zip-Slip verification, re-entrant file locking (`ArchiveLock` via `fcntl`), atomic staging (`os.replace`)

## 6. Hosting & Cloud Infrastructure
- **Frontend PWA**: Firebase App Hosting (`pivot/apphosting.yaml` and `pivot/firebase.json`)
- **Backend Services**: Cloud Run / GKE container deployment with keyless IAM (`roles/iam.serviceAccountTokenCreator`)
