# Architectural specification: sandboxed Emacs execution engine with Google Antigravity SDK and Firebase Authentication

This document specifies the architecture for interfacing GNU Emacs processes using the Google Antigravity Python SDK (`google-antigravity`), isolated within Firejail sandboxes based on web user identifiers (`uid` or UUID) authenticated through Firebase Authentication Google Sign-In. It details the hermetic packaging model where each web user's environment, including their configuration, documents, helper scripts, and a statically compiled GNU Emacs binary, is bundled into a self-contained, persistent package.

---

## 1. System overview and design goals

### 1.1 Objective
The system provides a multi-tenant backend where authenticated web users interact with GNU Emacs workflows, including Org-mode document manipulation, headless document exports, literate programming code block execution (Org-Babel), and task agenda extraction. Autonomous AI agents powered by the Google Antigravity SDK orchestrate these workflows on behalf of authenticated users.

### 1.2 Core architectural principles
Every tenant is bound to a verified Firebase Authentication UID obtained from Google Sign-In (`googleSignIn`). No system-level Linux user accounts (`/etc/passwd`) are created on the host.

All Emacs and child processes execute inside strict Firejail sandboxes configured with private ephemeral directories, Linux namespaces, capability dropping, and Seccomp filters.

Every user environment is encapsulated in a single-file portable archive (`<uid>.zip`). This archive packages user documents, initialization scripts, custom Lisp extensions, and a statically compiled GNU Emacs binary that runs without host library dependencies.

The Google Antigravity SDK connects model reasoning with Emacs execution tools. Antigravity declarative safety policies enforce a deny-by-default posture that blocks host filesystem breakout and host shell access, permitting only registered Emacs tools with matching tenant predicates.

Execution sandboxes run with `--net=none` by default to prevent data exfiltration and server-side request forgery (SSRF).

---

## 2. High-level architecture

The system consists of five distinct layers:
1. Client and authentication layer: Web browser client using Google Sign-In via Firebase Auth.
2. API gateway and verification layer: FastAPI service that validates Firebase JWT ID tokens and establishes request tenancy.
3. Agent orchestration layer: Google Antigravity SDK `Agent` running with tenant-scoped configurations, declarative safety policies, and tool dispatchers.
4. Environment and storage manager: `UserArchiveManager` maintaining encrypted and signed `<uid>.zip` packages on disk or Google Cloud Storage, with re-entrant file locking and Zip-Slip defense.
5. Sandboxed execution layer: Ephemeral Firejail runtime executing the statically built Emacs binary inside isolated namespaces.

```
+-----------------------------------------------------------------------------------+
|                           Web Client (Google Sign-In)                             |
|                   Obtains Firebase JWT ID Token (contains UID)                    |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTPS / WebSocket (Bearer JWT)
                                          v
+-----------------------------------------------------------------------------------+
|                         API Gateway / Authentication                              |
|          • Verifies Firebase JWT via Google Public Keys / Admin SDK               |
|          • Validates UID format (RFC 4122 UUID / Alphanumeric Sanitization)       |
|          • Injects Authenticated Tenant Context: AuthenticatedTenant(uid)         |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Authenticated Request + User Context
                                          v
+-----------------------------------------------------------------------------------+
|                 Google Antigravity SDK Agent Orchestration Layer                  |
|          • Agent(LocalAgentConfig) with isolated app_data_dir per tenant          |
|          • Deny-by-default safety policy: policy.deny_all()                       |
|          • Specific tenant tool allowance: policy.allow("emacs_*", when=...)      |
|          • Tools: export, babel_execute, tangle, get_agenda, eval_elisp          |
+-----------------------------------------+-----------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+---------------------------------------+   +---------------------------------------+
|        User Archive Manager           |   |       Archive Concurrency Lock        |
|  • Reads / Writes <storage>/<uid>.zip |   |   fcntl.flock on <uid>.lock           |
|  • Enforces Zip-Slip Canonical Checks |   |   Prevents concurrent race conditions |
|  • Atomic Repack (.tmp -> os.replace) |   +---------------------------------------+
+-------------------+-------------------+
                    |
                    | Unpacks into ephemeral runtime directory
                    v
+-----------------------------------------------------------------------------------+
|      Ephemeral Runtime Directory (/tmp/emacs_jail_run/user_<uid>_<session_id>)    |
|      ├── .jail_metadata.json          (Tenant schema, timestamps, hashes)         |
|      ├── .emacs.d/init.el             (User initialization file)                  |
|      ├── .emacs_jail/                                                             |
|      │   ├── bin/emacs                (Statically compiled GNU Emacs binary)      |
|      │   ├── bin/emacs.pdmp           (Portable dump file)                        |
|      │   └── lisp/                    (Headless batch runner scripts)             |
|      └── workspace/                   (User documents: notes.org, data files)     |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | Firejail invocation (--private=<dir>)
                                          v
+-----------------------------------------------------------------------------------+
|                           Firejail Zero-Trust Sandbox                             |
|                                                                                   |
|  • Namespaces: Mount, PID, IPC (ipc-namespace), Network (--net=none)              |
|  • Security: caps.drop all, seccomp, noroot, nonewprivs, nosound, novideo         |
|  • Resource Limits: CPU (60s), RAM (1GB), NPROC (128), FSIZE (100MB)              |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 Hermetic Static GNU Emacs Process                           |  |
|  |   Executes batch Elisp commands using bundled .emacs_jail/bin/emacs         |  |
|  |   Zero dependencies on host glibc, shared libraries, or host filesystems   |  |
|  |   Falls back to host emacs binary if static binary is not provisioned       |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                          |
                                          | Execution completion & results returned
                                          v
+-----------------------------------------------------------------------------------+
|                              Atomic Repack & Cleanup                              |
|          • Repacks workspace and persistent files back to temporary archive       |
|          • Preserves .emacs_jail packaged binaries and user modifications         |
|          • Atomically replaces storage/<uid>.zip via os.replace                   |
|          • Recursively destroys ephemeral directory /tmp/...                      |
|          • Releases fcntl lock and returns result to Antigravity Agent            |
+-----------------------------------------------------------------------------------+
```

---

## 3. Web user identity and authentication

The tenancy model relies on Google Authentication managed through Firebase Authentication (`/firebase-auth-basics`).

### 3.1 Authentication flow
Client authentication: The frontend web application initiates Google Sign-In using the Firebase Web SDK.

ID token generation: Upon successful authentication, Firebase Auth returns a signed JSON Web Token (JWT) containing standard claims (`sub`, `iss`, `aud`, `exp`) and user attributes.

API request transmission: The client includes this token in the `Authorization: Bearer <id_token>` HTTP header on all API calls.

Server token validation: The backend server verifies the token against Google public key endpoints using the Firebase Admin SDK.

UID extraction: The verified `uid` claim identifies the tenant. In Firebase Auth, this is an alphanumeric string unique to the authenticated Google account.

```
Client (Browser)             API Gateway (Backend)             Firebase / Google Auth
       |                                |                                |
       |--- 1. Google Sign-In Popup --->|                                |
       |<-- 2. JWT ID Token (auth.uid) -|                                |
       |                                |                                |
       |--- 3. POST /api/v1/emacs/run ->|                                |
       |       (Bearer ID Token)        |                                |
       |                                |-- 4. Verify JWT Signature ---->|
       |                                |<-- 5. Valid Claims (uid) ------|
       |                                |                                |
       |                                |-- 6. Sanitize & Validate UID   |
       |                                |-- 7. Dispatch to Agent/Jail    |
       |<-- 8. Execution Result --------|                                |
```

### 3.2 Firebase Auth configuration (`firebase.json`)
Authentication providers are declared in `firebase.json`:

```json
{
  "auth": {
    "providers": {
      "googleSignIn": {
        "oAuthBrandDisplayName": "Emacs-Web Workspace",
        "supportEmail": "support@example.com",
        "authorizedRedirectUris": [
          "https://emacs-web.firebaseapp.com/__/auth/handler",
          "http://localhost:4000"
        ]
      }
    }
  }
}
```

Deploying this configuration creates the necessary OAuth clients:

```bash
npx -y firebase-tools@latest deploy --only auth
```

### 3.3 Token verification and UID validation
The backend authenticates incoming requests using a dedicated FastAPI dependency:

```python
import re
from typing import Optional
from dataclasses import dataclass
from fastapi import Request, HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import auth as firebase_auth

security = HTTPBearer()

# Strict UID pattern: alphanumeric, hyphen, underscore, and dots. Length 1 to 128 characters.
# Rejects slashes, backslashes, relative path dots (.., .), and null bytes.
UID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]{0,127}$")
UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


@dataclass(frozen=True)
class AuthenticatedTenant:
    uid: str
    email: Optional[str]
    display_name: Optional[str]


def validate_tenant_uid(raw_uid: str) -> str:
    """Validate UID format to prevent path traversal and injection attacks."""
    clean_uid = str(raw_uid).strip()
    if not clean_uid:
        raise ValueError("Tenant UID must not be empty.")
    if clean_uid in (".", "..") or "/" in clean_uid or "\\" in clean_uid or "\0" in clean_uid:
        raise ValueError(f"Dangerous path traversal characters detected in UID: {clean_uid!r}")
    if not (UID_PATTERN.match(clean_uid) or UUID_PATTERN.match(clean_uid)):
        raise ValueError(
            f"Invalid tenant UID '{clean_uid}'. Must match pattern: {UID_PATTERN.pattern}"
        )
    return clean_uid


async def get_current_tenant(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> AuthenticatedTenant:
    token = credentials.credentials
    try:
        decoded_token = firebase_auth.verify_id_token(token, check_revoked=True)
        raw_uid = decoded_token.get("uid")
        if not raw_uid:
            raise HTTPException(status_code=401, detail="Token lacks uid claim.")

        clean_uid = validate_tenant_uid(raw_uid)
        return AuthenticatedTenant(
            uid=clean_uid,
            email=decoded_token.get("email"),
            display_name=decoded_token.get("name"),
        )
    except firebase_auth.RevokedIdTokenError:
        raise HTTPException(status_code=401, detail="Token has been revoked.")
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired.")
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {err}")
```

### 3.4 Authorization and tenant boundary enforcement
The authenticated `uid` is injected into the request state. All subsequent interactions, including file reads, document writes, Emacs evaluations, and Antigravity tool dispatches, are parameterized by this validated UID. The architecture prevents any API parameter from overriding or substituting the authenticated UID.

---

## 4. Hermetic packaging and static GNU Emacs

### 4.1 Package design
Every user's isolated environment is stored as a single, durable `.zip` archive at `<storage_dir>/<uid>.zip`. This single-file design offers distinct operational advantages.

The entire user state can be backed up, migrated, or synchronized to cloud object storage (such as Google Cloud Storage `gs://<bucket>/users/<uid>.zip`) with a single atomic operation.

Every user possesses their own configuration, documents, and private copy of the static Emacs runtime.

Zip compression reduces the on-disk footprint of text files and Org documents.

### 4.2 Archive layout specification
Inside the user's `.zip` file, files are organized into a standard directory tree:

```
<uid>.zip
├── .jail_metadata.json          # Tenant metadata, versioning, SHA-256 hashes
├── .emacs.d/
│   └── init.el                  # User-specific Emacs initialization script
├── .emacs_jail/
│   ├── bin/
│   │   ├── emacs                # Statically linked GNU Emacs executable (Musl libc)
│   │   └── emacs.pdmp           # Portable dump file (if using pdmp)
│   └── lisp/
│       ├── org-export-runner.el # Headless batch exporter runner
│       ├── org-babel-runner.el  # Safe batch Babel code evaluator and tangler
│       └── org-agenda-runner.el # Org AST parser for native JSON task extraction
└── workspace/                   # User workspace directory
    ├── notes.org                # Default starter Org document
    └── projects/                # User document subdirectories
```

### 4.3 Manifest metadata schema (`.jail_metadata.json`)
The manifest tracks provenance, environment version, and integrity checksums:

```json
{
  "schema_version": "2.0.0",
  "uid": "google_oauth2_108293847291039847123",
  "created_at": "2026-10-13T17:40:00Z",
  "updated_at": "2026-10-13T17:42:00Z",
  "emacs_version": "29.4",
  "static_build_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "storage_metrics": {
    "total_uncompressed_bytes": 48291040,
    "compressed_bytes": 14920110,
    "file_count": 8
  },
  "permissions": {
    "network_enabled": false,
    "max_memory_bytes": 1073741824,
    "max_cpu_seconds": 60
  }
}
```

### 4.4 Static GNU Emacs build architecture

#### Rationale for static compilation
Standard GNU Emacs distributions dynamically link against host libraries: `libc.so`, `libm.so`, `libpthread.so`, `libncurses.so`, `libgnutls.so`, `libgmp.so`, and graphical toolkits. In a multi-tenant sandboxed environment:
1. Dynamic linking requires exposing host library directories (`/lib`, `/lib64`, `/usr/lib`) inside the sandbox, weakening isolation boundaries.
2. Host library updates can alter execution behavior or break ABI compatibility.
3. Packaging a statically compiled binary directly within the user environment guarantees self-containment, immutability, and reproducible execution across heterogeneous host operating systems.

#### Dumping strategy: pdmp versus none
GNU Emacs requires a dump file to preload core Elisp packages (`subr.el`, `simple.el`, and base macro definitions).
* `--with-dumping=none`: Produces an un-dumped bootstrap binary (`temacs`). When invoked, it must parse uncompiled Elisp source files sequentially on every startup. This incurs severe startup latency (several seconds per invocation) and is unsuited for batch runners.
* `--with-dumping=pdmp`: Produces a statically linked executable and a portable dump file (`emacs.pdmp`). The portable dump contains pre-initialized heap structures, enabling instant startup (sub-50ms). Both `emacs` and `emacs.pdmp` are bundled in `.emacs_jail/bin/`.

#### Alpine Linux / Musl compilation pipeline
The static binary is built inside an Alpine Linux container using Musl libc. Musl supports fully static binaries without runtime NSS dependencies. Dynamic modules are disabled via `--without-modules` because static Musl binaries do not support `dlopen`.

```dockerfile
# Stage 1: Build static GNU Emacs
FROM alpine:3.20 AS builder

RUN apk update && apk add --no-cache \
    build-base \
    gcc \
    musl-dev \
    ncurses-static \
    ncurses-dev \
    gmp-dev \
    gmp-static \
    texinfo \
    tar \
    xz \
    make \
    linux-headers

ARG EMACS_VERSION=29.4
WORKDIR /build

RUN wget https://ftp.gnu.org/gnu/emacs/emacs-${EMACS_VERSION}.tar.xz && \
    tar -xf emacs-${EMACS_VERSION}.tar.xz

WORKDIR /build/emacs-${EMACS_VERSION}

# Configure for fully static headless terminal-only execution
ENV CFLAGS="-static -O2 -fstack-protector-strong"
ENV LDFLAGS="-static -Wl,--as-needed"

RUN ./configure \
    --prefix=/opt/emacs-static \
    --without-x \
    --without-sound \
    --without-xpm \
    --without-jpeg \
    --without-tiff \
    --without-gif \
    --without-png \
    --without-rsvg \
    --without-cairo \
    --without-dbus \
    --without-gsettings \
    --without-selinux \
    --without-makeinfo \
    --without-modules \
    --without-native-compilation \
    --with-dumping=pdmp \
    --with-gnutls=no \
    --with-gmp=yes \
    --with-xml2=no \
    --with-json=no

RUN make -j$(nproc)
RUN make install
RUN strip -s /opt/emacs-static/bin/emacs

# Stage 2: Verification and artifact extraction
FROM alpine:3.20
COPY --from=builder /opt/emacs-static /opt/emacs-static

# Verify the binary is a static non-dynamic ELF executable
RUN ldd /opt/emacs-static/bin/emacs 2>&1 | grep -q "not a dynamic executable" || \
    ldd /opt/emacs-static/bin/emacs 2>&1 | grep -q "Not a valid dynamic program"

# Verify execution and pdmp loading
RUN /opt/emacs-static/bin/emacs --batch --eval '(message "Static Emacs %s loaded successfully" emacs-version)'
```

#### Binary integrity verification and execution fallback
Before execution inside the ephemeral runtime, the system verifies the SHA-256 hash of `.emacs_jail/bin/emacs` against the trusted digest recorded in `.jail_metadata.json`. If the hash does not match, execution halts immediately.

When the user archive contains an executable static Emacs at `.emacs_jail/bin/emacs`, `FirejailRunner` prioritizes that binary. If the static binary is not provisioned (for example, during lightweight testing), it falls back to the host binary specified by `JailConfig.emacs_bin`.

#### Storage optimization: seed templates and content-addressable deduplication
Packaging the static binary in every archive adds approximately 15 to 25 MB of compressed data per user. In production multi-tenant deployments, two strategies manage storage:
1. Seed template archive: When a new tenant is provisioned, the initial archive is cloned from a pre-compressed gold master template (`template_starter.zip`) rather than re-compressing static binaries from scratch.
2. Content-addressable binary store: The user archive can reference or unpack from a content-addressable store (`data/cas/bin/<hash>`), or link read-only base layers into the ephemeral runtime while preserving the standalone single-archive abstraction for export and migration.

---

## 5. Firejail sandbox isolation framework

Firejail provides kernel-level process containment using Linux namespaces, Seccomp system call filtering, and Linux capabilities dropping.

### 5.1 Sandbox profile configuration (`firejail/emacs-org.profile`)
The production Firejail profile enforces zero-trust process restrictions while allowing necessary Org-mode operations:

```ini
# Firejail profile for isolated Emacs and Org-Mode execution
# Specialized for multi-tenant, non-system user-ID sandboxed environments.

# Dedicated clean isolated /tmp directory (tmpfs)
private-tmp

# Restrict /dev to essential pseudo-devices (null, zero, urandom, tty, etc.)
private-dev

# Minimal /etc exposure
private-etc ca-certificates,crypto-policies,fonts,group,hosts,ld.so.cache,ld.so.conf,ld.so.conf.d,localtime,nsswitch.conf,passwd,resolv.conf,emacs

# Whitelist binaries allowed inside the sandbox (Emacs + org-babel runners)
private-bin emacs,python,python3,bash,sh,cat,ls,grep,sed,awk,find,which,head,tail,cut,sort,uniq,wc,tr,echo,date,make

# System hardening & attack surface reduction
caps.drop all
ipc-namespace
nonewprivs
noroot
nosound
notv
novideo
seccomp
restrict-namespaces
disable-mnt

# Zero-trust networking: isolate from LAN, localhost, and Internet
net none

# Default resource governance limits (RLIMITs)
# Prevent runaway processes, memory exhaustion, fork bombs, and quota denial of service
rlimit-cpu 60
rlimit-as 1073741824
rlimit-nproc 128
rlimit-fsize 104857600
```

`shell none` is deliberately omitted from `emacs-org.profile` because Org-Babel code evaluation requires invoking subprocess interpreters (such as Bash and Python) within the isolated mount namespace.

### 5.2 Linux namespace and kernel mechanisms
Mount namespace: Firejail creates a new mount namespace where `--private=<runtime_dir>` mounts the ephemeral runtime directory as virtual `$HOME`. Host paths (`/home`, `/root`, `/var`) are masked.

Network namespace: `--net=none` creates an isolated network namespace with only an unconfigured loopback interface. Emacs Lisp code and executed Babel scripts cannot open external sockets.

PID namespace: Processes inside the jail cannot inspect or signal processes running outside the jail.

IPC namespace: Shared memory segments and semaphores from the host are unmapped via `ipc-namespace`, preventing host IPC side-channel attacks.

Seccomp-BPF: System calls associated with kernel module loading, raw I/O, rebooting, and ptrace debugging are blocked.

Capabilities: All Linux capabilities are dropped (`caps.drop all`), and `noroot` prevents setuid privilege escalation.

### 5.3 Resource limits (RLIMITs)
To prevent fork bombs, algorithmic complexity attacks, and memory exhaustion, the execution engine enforces resource quotas:

| Limit Parameter | Default Value | Mechanism | Failure Behavior |
| :--- | :--- | :--- | :--- |
| CPU Time | 60 seconds | `RLIMIT_CPU` | Kernel sends `SIGXCPU`, followed by `SIGKILL` |
| Virtual Memory (AS) | 1024 MB (1 GB) | `RLIMIT_AS` | Allocation fails (`ENOMEM`) |
| Process Count | 128 processes | `RLIMIT_NPROC` | `fork()` returns `EAGAIN` (blocks fork bombs) |
| File Output Size | 100 MB | `RLIMIT_FSIZE` | Write returns `EFBIG` |
| Wall-Clock Timeout | 90.0 seconds | Python `subprocess` supervisor | Process tree terminated via `SIGKILL` |

---

## 6. Google Antigravity SDK integration

The Google Antigravity SDK (`google-antigravity`) provides the agentic interface. An AI agent reasons about user tasks, formulates plans, and dispatches Emacs operations via structured Python tool calls.

### 6.1 SDK concepts and architecture mapping
* `Agent`: The orchestrator created with a `LocalAgentConfig`. It manages the conversation lifecycle, tools, and hooks.
* `Conversation`: The stateful session tracking turns and context history.
* `Connection`: The abstraction managing model communication.
* `CapabilitiesConfig`: Enables tool calling capabilities.
* `hooks.policy`: Declarative access control rules that evaluate and filter tool invocations before execution.
* `ToolContext`: Injected context for tools needing cross-turn session state.

### 6.2 Multi-tenant agent configuration and safety policies
In `LocalAgentConfig`, all built-in tools (`view_file`, `create_file`, `edit_file`, `list_directory`, etc.) are enabled by default. To prevent host filesystem breakout:
1. Deny-by-default posture: `policy.deny_all()` denies all tools at the global wildcard level.
2. Tenant tool allowance: `policy.allow("emacs_*", when=...)` allows only registered Emacs tools whose `uid` argument matches the authenticated tenant UID.
3. Priority evaluation: In the Antigravity SDK, `policy.allow("emacs_*", ...)` operates at Prefix Wildcard Allow (Priority 6), which takes precedence over `policy.deny_all()` at Global Wildcard Deny (Priority 7). Calls targeting a mismatched UID fail the predicate and fall through to `policy.deny_all()`.
4. Isolated application data directory: `app_data_dir` points to an ephemeral directory (`<runtime_dir>/agent_brain`) so internal agent scratch files never leak across users.

```python
from pathlib import Path
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig
from google.antigravity.hooks import policy

from emacs_jail.agent_tools import ANTIGRAVITY_TOOLS
from emacs_jail.config import JailConfig


def create_tenant_agent_config(
    tenant_uid: str,
    ephemeral_runtime_dir: Path,
    jail_config: JailConfig,
) -> LocalAgentConfig:
    """Create a secured LocalAgentConfig for a specific tenant session."""

    # Safety policy enforcing tenant isolation through deny-by-default
    policies = [
        # Global deny on all built-in and unregistered tools (blocks host view_file, run_command, etc.)
        policy.deny_all(),
        # Allow only sandboxed Emacs tools when the target UID strictly matches the session tenant
        policy.allow(
            "emacs_*",
            when=lambda args: args.get("uid") == tenant_uid,
            name="enforce_tenant_uid_boundary",
        ),
    ]

    # Tenant-specific app data directory for agent scratch files
    tenant_brain_dir = ephemeral_runtime_dir / "agent_brain"
    tenant_brain_dir.mkdir(parents=True, exist_ok=True)

    system_instructions = (
        f"You are a specialized Emacs and Org-mode assistant operating for tenant '{tenant_uid}'. "
        "You can inspect user documents, execute safe Org-Babel code blocks, export documents "
        "to HTML or Markdown, and query scheduled tasks. All operations run inside an isolated sandbox."
    )

    return LocalAgentConfig(
        system_instructions=system_instructions,
        tools=ANTIGRAVITY_TOOLS,
        policies=policies,
        capabilities=CapabilitiesConfig(),
        app_data_dir=str(tenant_brain_dir.resolve()),
    )
```

### 6.3 Exposed agent tools
The framework registers ten high-level tools conforming to the Antigravity SDK callable format:

1. `emacs_user_environment_init(uid, description)`: Initializes starter `<uid>.zip` containing `.emacs.d/init.el`, `.emacs_jail/bin/emacs`, and `workspace/notes.org`.
2. `emacs_user_list_environments()`: Lists registered tenant archives and storage metrics.
3. `emacs_org_export(uid, org_file, export_format, output_file)`: Headless export of Org documents to HTML, Markdown, LaTeX, or plain text.
4. `emacs_org_babel_execute(uid, org_file, output_file)`: Executes embedded source blocks (Python, Elisp, Bash) inside the sandbox, populating `#+RESULTS:` blocks.
5. `emacs_org_babel_tangle(uid, org_file)`: Tangles source code blocks into runnable files inside the workspace.
6. `emacs_org_get_agenda(uid, files)`: Parses TODO items, priorities, deadlines, and schedules into structured JSON.
7. `emacs_eval_elisp(uid, elisp_expression)`: Evaluates arbitrary S-expressions safely in batch mode.
8. `emacs_user_put_file(uid, filepath, content)`: Writes or updates a file directly in the tenant archive.
9. `emacs_user_get_file(uid, filepath)`: Reads file content from the tenant archive.
10. `emacs_user_list_files(uid)`: Inspects files and directories inside the tenant archive.

---

## 7. Storage lifecycle and concurrency control

### 7.1 Lifecycle of a sandboxed execution session

```
1. Request Received (uid)
            |
            v
2. Acquire Exclusive Lock
   fcntl.flock(storage/<uid>.lock, LOCK_EX)
            |
            v
3. Unpack Archive
   Extract storage/<uid>.zip -> /tmp/emacs_jail_run/user_<uid>_<session_id>
   [Zip-Slip Validation: verify every member path stays within runtime dir]
            |
            v
4. Verify Static Emacs Binary
   Compute SHA-256(.emacs_jail/bin/emacs) == expected_hash
            |
            v
5. Execute Command in Firejail
   firejail --profile=emacs-org.profile --private=/tmp/... .emacs_jail/bin/emacs ...
            |
            v
6. Repack Archive
   Pack /tmp/... into storage/<uid>.zip.tmp.<pid>_<uuid>
   [Preserve .emacs_jail packaged binaries, exclude ephemeral run dirs]
            |
            v
7. Atomic Swap
   os.replace(tmp_archive, storage/<uid>.zip)
            |
            v
8. Cleanup Runtime
   shutil.rmtree(/tmp/emacs_jail_run/user_<uid>_<session_id>)
            |
            v
9. Release Lock
   fcntl.flock(storage/<uid>.lock, LOCK_UN)
```

### 7.2 Concurrency control (`ArchiveLock`)
To prevent concurrent requests from corrupting the single-file archive, the system uses multi-process, thread-reentrant file locking:
* A lock file is created at `<storage_dir>/<uid>.lock`.
* Locking uses `fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)` with a polling timeout (default 20 seconds).
* Re-entrancy within the same Python thread is tracked using thread identifiers to avoid self-deadlock.

### 7.3 Zip-Slip security defense
Archives uploaded or restored must not write files outside their target extraction root. During extraction, the `UserArchiveManager` evaluates canonical paths:

```python
def safe_extract_zip(zip_file: zipfile.ZipFile, target_dir: Path) -> None:
    target_canonical = str(target_dir.resolve())
    for member in zip_file.infolist():
        # Reject absolute paths or paths with null bytes
        if member.filename.startswith(("/", "\\")) or "\0" in member.filename:
            raise ZipSlipSecurityError(f"Illegal path in archive: {member.filename}")

        resolved_dest = (target_dir / member.filename).resolve()
        if os.path.commonpath([target_canonical, str(resolved_dest)]) != target_canonical:
            raise ZipSlipSecurityError(
                f"Path traversal detected: {member.filename} resolves outside target directory."
            )
        if member.is_dir():
            resolved_dest.mkdir(parents=True, exist_ok=True)
        else:
            resolved_dest.parent.mkdir(parents=True, exist_ok=True)
            with zip_file.open(member) as source, open(resolved_dest, "wb") as target:
                shutil.copyfileobj(source, target)
            mode = (member.external_attr >> 16) & 0o777
            if mode:
                try:
                    os.chmod(resolved_dest, mode)
                except OSError:
                    pass
```

### 7.4 Atomic commit guarantees
When changes occur in the runtime directory, updates are committed atomically:
1. All files are written into a newly created temporary archive: `<storage_dir>/<uid>.tmp.<pid>_<uuid>.zip`.
2. Packaged binaries in `.emacs_jail/bin` are retained with their executable permission bits preserved via `external_attr`.
3. The zip file is flushed and closed.
4. `os.replace(tmp_archive, target_archive)` replaces the old archive with the new archive in a single filesystem directory inode swap. This guarantees that unhandled exceptions, power loss, or crashes never leave a corrupt, partially written archive.

---

## 8. Threat model and security analysis

The architecture is evaluated against the STRIDE threat model:

| Threat Category | Potential Attack Vector | Mitigation Strategy |
| :--- | :--- | :--- |
| Spoofing | Attacker crafts fake JWT token or claims identity of another user | Firebase Admin SDK cryptographically validates token signatures and expiration against Google public keys. UID is extracted solely from verified token claims. |
| Tampering | User modifies static Emacs binary inside `.zip` to include shellcode | System validates the SHA-256 hash of `.emacs_jail/bin/emacs` against an immutable trusted digest prior to every execution. |
| Tampering | Zip-Slip path traversal overwrites system files during extraction | Canonical path validation verifies that every archive member resolves strictly within the ephemeral runtime directory. |
| Repudiation | Malicious actions executed inside Org-Babel without audit trail | All tool dispatches, exit codes, CPU usage, and timestamps are logged with tenant UIDs. |
| Information Disclosure | Untrusted Org-Babel code accesses host `/etc/shadow`, SSH keys, or other tenant files | Firejail `--private` replaces the home directory; host paths are unmapped; Linux mount namespaces prevent cross-tenant directory access. |
| Information Disclosure | Code block sends sensitive documents over LAN or WAN | Firejail runs with `--net=none`. The network namespace lacks external interfaces, preventing outbound data transmission. |
| Denial of Service | Fork bombs or infinite loops in Babel scripts | `RLIMIT_NPROC` limits max processes to 128; `RLIMIT_CPU` limits CPU time to 60s; Python subprocess supervisor enforces a 90s hard timeout. |
| Denial of Service | Disk space exhaustion via massive file output | `RLIMIT_FSIZE` limits max file writes to 100MB per file; storage quotas enforce per-tenant archive size caps. |
| Elevation of Privilege | Sandbox breakout to obtain host root permissions | Firejail drops all Linux capabilities (`caps.drop all`), enables Seccomp-BPF filters, sets `noroot` and `nonewprivs`. |

---

## 9. Verification, testing, and operational runbook

### 9.1 Verification test matrix
The test suite validates every layer of the architecture:

* Unit tests (`tests/test_archive.py`):
  * Validation and rejection of illegal UIDs (directory traversal characters, null bytes).
  * Starter archive generation and metadata schema validation.
  * Zip-Slip path traversal defense with intentionally crafted malicious archives.
  * Direct archive file reads, writes, and deletions.
  * Preservation of packaged `.emacs_jail/bin/emacs` binaries and executable permissions across repacks.
* Sandbox tests (`tests/test_sandbox.py`):
  * Command assembly verifying `--private`, `--net=none`, and Seccomp arguments.
  * Profile flag overrides and network configuration.
  * Detection and prioritization of packaged hermetic static Emacs binary when present in the runtime directory.
* User environment tests (`tests/test_user_env.py`):
  * Lifecycle management of active runtime sessions, automatic extraction, and lock cleanup.
  * Path resolution security confirming containment within workspace boundaries.
* Integration tests (`tests/test_emacs_org.py`):
  * Headless Emacs evaluation inside active Firejail sandboxes.
  * Headless Org-mode HTML and Markdown exports.
  * Org-Babel code block execution and result capture.
  * Literate programming source block tangling.
  * Structured JSON agenda parsing from headlines and TODO items.
  * Multi-tenant concurrency tests verifying complete isolation between separate UIDs.

### 9.2 Running the test suite
Tests are run using `uv` from the repository root:

```bash
uv run pytest -v
```

### 9.3 Health checks and monitoring
For production deployments, the system exposes Prometheus metrics:
* `emacs_jail_executions_total{status, uid}`: Total number of sandbox executions.
* `emacs_jail_execution_duration_seconds{operation}`: Histogram of execution durations.
* `emacs_jail_archive_bytes{uid}`: Size of user single-file archives.
* `emacs_jail_lock_wait_seconds`: Time spent waiting for `ArchiveLock` acquisition.
* `emacs_jail_security_violations_total{violation_type}`: Counter for Zip-Slip attempts, hash mismatches, or illegal UID rejections.
