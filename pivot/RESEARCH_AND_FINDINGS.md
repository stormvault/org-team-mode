# Research & Architecture Findings: Norang Org-Mode Integration, PWA & Firebase MFA

**Document Version:** 1.0.0  
**Framework:** Angular 22.0.x (Standalone, Signals, Vitest)  
**Target Environment:** Firebase App Hosting & Modern Browsers (PWA)  
**Author:** Antigravity Engineering

---

## 1. Executive Summary & Problem Framing

Modern productivity applications often suffer from a false dichotomy:
1. Fast, highly visual habit and interval dashboards (such as **HabitFlow Pro**) that excel at real-time momentum, daily streaks, sub-daily interval reminders, and immediate auditory cues.
2. Canonical plain-text organizational workflows (pioneered by Bernt Hansen in *"Org Mode - Organize Your Life In Plain Text"*, `https://doc.norang.ca/org-mode.html`) that provide unmatched depth for task state transitions, clock tracking, GTD weekly reviews, capture workflows, refiling, and literate programming.

This project unifies both worlds into a unified **Progressive Web Application (PWA)** built on **Angular >= 22**, using standard browser storage (IndexedDB, localStorage) and modern Web APIs (Service Worker, Web Audio API / Tone.js, Web App Manifest). The application operates entirely via browser-safe, collision-free keyboard shortcuts and is architecturally structured for **Firebase App Hosting** with **Firebase Authentication**, enforcing **Firebase Phone Authentication as mandatory Multi-Factor Authentication (MFA)** and supporting multi-user project collaboration.

---

## 2. In-Depth Analysis of Norang's Org-Mode System

Bernt Hansen's configuration represents one of the most mature implementations of Getting Things Done (GTD) in plain text. Below is the systematic mapping of all core subsystems described in `doc.norang.ca/org-mode.html`:

### 2.1 Task States & Lifecycle Workflow
Norang defines a strict 7-state task progression:
- `TODO`: An actionable task ready to be prioritized.
- `NEXT`: A task that is the very next action to execute on an active project. Kept on the primary radar.
- `STARTED`: The task currently being actively worked on (automatically clocked in).
- `WAITING`: Blocked on an external dependency (a person, an email reply, a delivery). Requires a note explaining what is waited on.
- `HOLD`: Paused by choice. Not actively blocked by others, but deferred to a future date or indefinitely.
- `DONE`: Task completed. Records completion timestamp `CLOSED: [YYYY-MM-DD Day HH:MM]`.
- `CANCELLED`: Abandoned task with explanation note.

#### Fast TODO Selection
Instead of cycling sequentially through 7 states with multiple keystrokes, Norang uses fast single-key selection from a prompt:
- `t` -> `TODO`
- `n` -> `NEXT`
- `s` -> `STARTED`
- `w` -> `WAITING`
- `h` -> `HOLD`
- `d` -> `DONE`
- `c` -> `CANCELLED`

### 2.2 Org Capture & Refiling
- **Capture Staging (`refile.org`)**: All incoming tasks, notes, phone logs, and meetings are captured rapidly into a dedicated staging file (`refile.org`) so that the current train of thought is never interrupted.
- **Capture Templates**:
  - `[t] Task`: Headline with `TODO` keyword, inactive creation timestamp, and optional effort estimate.
  - `[h] Habit`: Habit specification with `STYLE: habit` property and scheduled interval repeaters (`.+1d`, `.+1w`, or sub-daily interval).
  - `[n] Note`: Quick timestamped observation or knowledge capture.
  - `[p] Phone Call / Conversation`: Records interlocutor, subject, timestamp, and action items.
  - `[m] Meeting`: Records meeting attendees, agenda topics, and action outcomes.
- **Refiling**: Staged items in `refile.org` are reviewed and refiled into permanent files (`todo.org`, `habits.org`, `projects.org`, `archive.org`) or nested under existing project trees.

### 2.3 Custom Agenda Views
Norang's primary workspace is a consolidated multi-block custom agenda view:
1. **Daily / Weekly Agenda**: Shows scheduled items, deadlines, appointments, and active habit bars.
2. **`NEXT` Actions Block**: Immediate tasks across all active projects.
3. **Waiting & Delegated Block**: Tasks with state `WAITING` with follow-up timestamps.
4. **On Hold Block**: Tasks with state `HOLD`.
5. **Stuck Projects Block**: Identifies projects (headlines with subtasks or marked as projects) that currently have **zero** tasks in `NEXT` or `STARTED` state. This prevents projects from languishing unnoticed.
6. **Dynamic Tag Filtering (`/ RET`)**: Allows instantaneous filtering of the entire agenda by context tags (`:office:`, `:home:`, `:phone:`, etc.).

### 2.4 Time Clocking & Reporting
- **Clock In (`I`) / Clock Out (`O`)**: Exact minute-level tracking with `CLOCK: [start]--[end] => duration` drawers.
- **Default Clock Task**: When no specific task is active, time can default to an organization/administrative bucket so all working time is accounted for.
- **Clock History**: Quick resume of recently clocked tasks.
- **Effort vs. Actuals (`:Effort: 0:30` vs `CLOCKSUM`)**: Compares planned estimates against recorded clock sum.
- **Overtime Alert**: Highlights tasks whose accumulated clock time exceeds their estimated effort.
- **Clock Table Summary**: Generates structured hierarchical summaries grouped by day, week, or project.

### 2.5 Org-Babel & Literate Programming
- Evaluation of embedded code blocks (`#+BEGIN_SRC python ... #+END_SRC`).
- Generation of deterministic `#+RESULTS:` blocks.
- Literate source extraction (`org-babel-tangle`) to output executable scripts.
- Multi-format document export to Markdown, HTML, and CSV.

---

## 3. Browser-Compatible, Non-Default Keyboard Shortcuts

A critical constraint of web-based Emacs/Org implementations is the collision with native browser keyboard shortcuts. Attempting to override browser hotkeys like `Ctrl+W` (close tab), `Ctrl+N` (new window), `Ctrl+T` (new tab), `Ctrl+R` (reload), `Ctrl+P` (print), `Ctrl+S` (save page), or `Ctrl+F` (find) creates severe user friction and OS-level inconsistencies.

### 3.1 Non-Default Shortcut Scheme
We implement a three-tier keyboard architecture that is 100% collision-free across Chrome, Firefox, Safari, and Edge:

1. **Global Application Chords (`Alt+Shift+<Key>`)**:
   - `Alt+Shift+C`: Open Org Capture Drawer
   - `Alt+Shift+A`: Open Custom Agenda Dashboard
   - `Alt+Shift+I`: Clock In Current Task / Habit
   - `Alt+Shift+O`: Clock Out Active Clock
   - `Alt+Shift+T`: Open Fast TODO State Selection
   - `Alt+Shift+R`: Open Task Refiling Modal
   - `Alt+Shift+E`: Open Document Exporter (Markdown / HTML / CSV)
   - `Alt+Shift+H`: Toggle HabitFlow Streaks & Interval Timers
   - `Alt+Shift+P`: Toggle Project Collaboration & Sharing Panel
   - `Alt+Shift+K`: Open Keyboard Shortcuts Cheat Sheet Modal

2. **Modal Context Hotkeys (Single Keys when Dialog Active)**:
   - In Capture: `t` (task), `h` (habit), `n` (note), `p` (phone), `m` (meeting).
   - In TODO State Selector: `t` (TODO), `n` (NEXT), `s` (STARTED), `w` (WAITING), `h` (HOLD), `d` (DONE), `c` (CANCELLED).
   - Universal: `Escape` dismisses any open dialog; `Enter` confirms.

3. **Headline Navigation Speed Commands**:
   - When focus is in headline navigation mode (not inside a text input):
     - `j` / `k` or `Down` / `Up`: Navigate headlines.
     - `Space` / `Tab`: Toggle headline folding.
     - `t`: Cycle TODO state.
     - `I`: Clock in.
     - `O`: Clock out.

---

## 4. Progressive Web Application (PWA) & Web Storage Standards

### 4.1 Progressive Web Application (PWA)
- **Web App Manifest (`manifest.webmanifest`)**:
  - `display: standalone` for an app-like window free of browser URL bars.
  - Configured icon sets (`192x192`, `512x512`), theme colors, and background colors.
  - OS-level shortcuts for immediate action: "Quick Capture", "View Agenda", "Daily Habits".
- **Service Worker (`sw.js`)**:
  - Offline-first cache strategy: precaching shell assets (HTML, CSS, JS, fonts).
  - Cache-fallback for audio assets and dynamic offline availability.
  - Install prompt lifecycle tracking (`beforeinstallprompt`).

### 4.2 Web Standards Storage Architecture
1. **IndexedDB (Primary Document & History Store)**:
   - Stores complete `.org` documents as plain text alongside structured JSON AST trees.
   - Dedicated object stores:
     - `org_files`: Keyed by filename (`refile.org`, `todo.org`, `habits.org`, `projects.org`, `archive.org`).
     - `clock_entries`: Exact timestamps, durations, and task IDs for reporting.
     - `habit_logs`: Timestamped check-ins for interval timers and daily streaks.
     - `revision_history`: Local append-only revision snapshots.
2. **localStorage (UI State & Preferences)**:
   - Fast synchronous access for:
     - Theme preference (`light` / `dark`).
     - Audio sound toggle (`enabled` / `muted`).
     - Last active view and filter selections.
3. **Web Audio API & Tone.js**:
   - Synthesized melodic chimes for interval triggers and completion.
   - Generates pure harmonic synthesis locally without external MP3 network requests.

---

## 5. Multi-User Collaboration & Firebase Phone MFA Linking Architecture

### 5.1 Deployment Model: Firebase App Hosting
Firebase App Hosting provides managed serverless hosting optimized for modern full-stack web frameworks.
- Configuration: `apphosting.yaml` defines environment settings and memory allocation.
- `firebase.json` configures the app hosting root and static headers.

### 5.2 Mandatory Phone Authentication as Multi-Factor Authentication (MFA)
The core security requirement states:
> "all requiring Firebase Phone Authentication as MFA, this requirement should, when in-complete, should prevent and redirect a registered user to an account linking registration that will register and link his current account, with a new registration / authentication that uses Firebase Phone Authentication."

#### Architecture & Enforcement Flow:
```
[User Sign-In / Register (Google or Email/Password)]
                 │
                 ▼
      [Auth Service / Guard]
                 │
      Is Phone MFA Linked? (user.phoneMfaLinked)
           ├── YES ──► Allow Access to Dashboard, Org Files & Shared Projects
           └── NO  ──► PREVENT access & REDIRECT immediately to /link-phone
                             │
                             ▼
              [Dedicated Account Linking Registration View]
              - Displays current Google / Email session identity
              - Step 1: Enter Phone Number (E.164) -> sendPhoneVerificationCode()
              - Step 2: Recaptcha & SMS Verification Code (OTP: 123456)
              - Step 3: linkPhoneMfa() links Phone Authentication to active account
                             │
                             ▼
              Account Linked & Verified!
              phoneMfaLinked = true, registeredUsers directory updated
                             │
                             ▼
              Redirect to Main Org Dashboard (/dashboard)
```

#### Angular Guard & Router Implementation:
- `mfaGuard`: Protects private and collaborative routes (`/dashboard`).
  - If user is not authenticated: redirects to `/login`.
  - If user is authenticated BUT `!user.phoneMfaLinked`: redirects to `/link-phone` (Account Linking Registration).
  - If user is authenticated AND `user.phoneMfaLinked`: allows navigation.
- In-Component Reactive Gating:
  - `selectTab()` intercepts clicks to `'daily'`, `'intervals'`, `'agenda'`, or `'org'` if `phoneMfaRequired()` is true, immediately redirecting to `'link-phone'` and displaying an explicit security denial toast.

### 5.3 Multi-User Project Segregation & Collaboration
- **Registered Users Directory**:
  - `FirebaseAuthService` maintains an active directory of registered users across Google and Email auth providers (`Alice Engineer`, `Bob Vance`, `Charlie Unverified`, `David Password`).
  - Tracks individual Phone MFA completion status.
- **Strict Collaborator Addition Rules**:
  - **Invite by Email**: Sends a project invitation to any Google or external email address.
  - **Add by Name (One at a time)**: Allows selecting or typing an existing user by name. The service verifies:
    1. The user must already be registered in Firebase via Google or Email Authentication.
    2. The user must have completed Firebase Phone Authentication MFA (`phoneMfaLinked: true`).
    If either check fails, the operation is blocked with a descriptive error (`"User has not completed Firebase Phone Authentication MFA"` or `"User is not registered"`).
- **Multi-User Personal File Isolation**:
  - `StorageService` scopes personal Org files (`todo.org`, `habits.org`, `refile.org`, `notes.org`, `archive.org`) by user UID (`org_user_${uid}_${filename}`).
  - Switching between users completely segregates private files.
  - Collaborative project files (`projects/<project-id>.org`) are stored in project scope and dynamically grouped in the Org file editor under `Collaborative Project Files (Shared)`.

---

## 6. HabitFlow Pro Integration Strategy

The attached HabitFlow Pro dashboard is modularized into Angular 22 components:
1. **Habit Engine Service (`HabitService`)**:
   - Manages daily habits and sub-daily intervals.
   - Computes current streaks, best streaks, and today's check-in metrics.
   - Integrates with Org-Mode's `:STYLE: habit` property and SCHEDULED repeaters (`.+1d`, `.+40m`).
   - Checking in a habit advances the Org scheduled date and records a state transition cycle (`TODO` -> `TODO` with next date).
2. **Precision Timer Engine (`TimerService`)**:
   - Interval countdown running with second-level precision.
   - Tone.js / Web Audio chime notifications when timers lapse.
3. **Audio Service (`AudioService`)**:
   - Synthesizer generating melodic cues (`E5 -> G5 -> C6` on interval trigger; `C5 -> G5` on check-in).
4. **Theme & UI Signals**:
   - Angular Signals (`signal`, `computed`) driving reactive UI updates without Zone.js overhead.

---

## 7. Verification & Testing Strategy

- **Unit Testing**: Vitest test runner executing 52 automated tests across 8 test suites:
  - Norang task state machine transitions, fast selection, and transition logging (`org-engine.service.spec.ts`).
  - Habit check-in with scheduled repeater advancement and streak algorithms (`habit.service.spec.ts`).
  - Collision-free Alt+Shift chords and modal single-key fast TODO states (`keyboard-shortcuts.service.spec.ts`).
  - Multi-user private storage isolation and collaborative project file persistence (`storage.service.spec.ts`).
  - Firebase Authentication, Phone MFA linking, and eligible collaborator filtering (`firebase-auth.service.spec.ts`).
  - Project collaboration, email invites, and name-based adding with Phone MFA enforcement (`project-collaboration.service.spec.ts`).
  - Route guard redirection logic for incomplete MFA (`mfa.guard.spec.ts`).
  - Full end-to-end component lifecycle, MFA blocking, and UI tab navigation (`app.spec.ts`).
- **Production Compilation**: Clean `ng build` producing optimized production bundles with code splitting in `pivot/dist/pivot`.
