# Specification: Norang Org-Mode PWA Integration with HabitFlow & Firebase MFA Phone Linking

## 1. Overview
This track delivers a modern Progressive Web Application (PWA) built with **Angular >= 22** in `@./pivot/`. It bridges the high-precision interval habit tracking of the attached **HabitFlow Pro** dashboard with the comprehensive plain-text organizational power described in Bernt Hansen's canonical reference (*"Org Mode - Organize Your Life In Plain Text"*, `https://doc.norang.ca/org-mode.html`).

The architecture leverages standard browser storage (IndexedDB, localStorage) and web standards (Service Workers, Web Audio / Tone.js, Web App Manifest), completely driven by browser-safe, non-default, collision-free keyboard shortcuts. It features a complete multi-tenant, multi-user project collaboration design intended for **Firebase App Hosting** with **Firebase Authentication** (Email & Google Sign-In) enforcing **Firebase Phone Authentication as mandatory Multi-Factor Authentication (MFA)**, including redirection to account linking registration when phone MFA is incomplete.

## 2. Functional Requirements

### 2.1 Norang Org-Mode Complete Featureset
1. **Task States & Workflow**:
   - Standard Norang TODO state sequence: `TODO`, `NEXT`, `STARTED`, `WAITING`, `HOLD`, `DONE`, `CANCELLED`.
   - Fast TODO selection modal/panel with direct mnemonic hotkeys (`t`, `n`, `s`, `w`, `h`, `d`, `c`).
   - State transition triggers and logging (recording state change timestamps and optional note prompts).
2. **Org Capture**:
   - Capture templates matching Norang's setup:
     - `[t]` Task (default target: refile inbox)
     - `[h]` Habit (interval or daily habit entry)
     - `[n]` Quick Note (with timestamp)
     - `[p]` Phone Call / Log (caller, subject, action item)
     - `[m]` Meeting (attendees, discussion notes)
   - Fast capture popup drawer/dialog accessible instantly via shortcut.
3. **Refiling System**:
   - Refiling tasks from `refile.org` to target files (`todo.org`, `habits.org`, `projects.org`, `notes.org`, `archive.org`) or nested subtrees.
   - Target selection autocomplete and hierarchical tree refile.
4. **Custom Agenda Views**:
   - Norang multi-block custom agenda:
     - Daily / Weekly calendar schedule with deadlines and scheduled items.
     - `NEXT` Action List (tasks ready to work on immediately).
     - Waiting & Delegated Tasks (`WAITING`).
     - On Hold / Paused Tasks (`HOLD`).
     - Stuck Projects view (identifying multi-task projects lacking any active `NEXT` task).
   - Fast Tag Filtering (`/ RET` behavior) to dynamically filter agenda views by context tag (e.g. `:office:`, `:home:`, `:phone:`).
5. **Time Clocking & Time Reporting**:
   - Clocking In (`I`) and Clocking Out (`O`) with automated timestamp recording.
   - Default clock task support (clock in to default fallback task when idle).
   - Clock history tracking and quick clock-in resume from recent tasks.
   - Clock summary table reports grouped by day, week, and project.
   - Effort estimates (`:Effort: 0:30`) vs Clock Sum (`CLOCKSUM`) comparison and overtime visual indicator.
6. **Tags & Context Management**:
   - Context tags: `:phone:`, `:mail:`, `:errand:`, `:boss:`, `:home:`, `:work:`, `:crypt:`.
   - Filetags and inheritance support.
7. **GTD & Project Management**:
   - Subtree project hierarchy with task dependencies.
   - Weekly review checklist and workflow assistant.
8. **Archiving & Cleanup**:
   - Archive subtree to archive file (`archive.org`) or internal `:ARCHIVE:` tag concealing.
9. **Publishing & Literate Programming (Org-Babel)**:
   - Org-Babel code blocks evaluation simulation with `#+RESULTS:` block generation.
   - Literate source code tangling (`org-babel-tangle`).
   - Document export: Export to clean Markdown, HTML, and Table to CSV.

### 2.2 Keyboard Shortcut Architecture
- Must use browser-compatible, non-default, unused keyboard shortcuts that do **NOT** collide with native browser actions (e.g. avoiding Ctrl+T, Ctrl+W, Ctrl+N, Ctrl+R, Ctrl+S).
- Standard key scheme:
  - `Alt+Shift+C`: Quick Capture Drawer
  - `Alt+Shift+A`: Custom Agenda Dashboard
  - `Alt+Shift+I`: Clock In Current Task
  - `Alt+Shift+O`: Clock Out Active Clock
  - `Alt+Shift+T`: Cycle / Fast Select TODO State
  - `Alt+Shift+R`: Refile Selected Task
  - `Alt+Shift+E`: Export Document (HTML/Markdown/CSV)
  - `Alt+Shift+P`: Toggle Project Collaboration Panel
  - `Alt+Shift+K`: Keyboard Shortcuts Cheat Sheet Modal
  - Speed Commands: When navigating headlines, single key presses (`t`, `I`, `O`, `r`, `a`, `c`) trigger immediate actions without typing into text fields.

### 2.3 HabitFlow Pro Precision Dashboard Integration
- Full preservation and enhancement of the attached HabitFlow single page application:
  - Daily streaks calculation with fire animation and streak records.
  - Sub-daily interval timers (e.g., 20-min stretch, 40-min hydration) with countdown display and progress bar.
  - Tone.js / Web Audio chimes on interval triggers and completion.
  - Dark / Light mode toggle conforming to modern CSS color-scheme standards.
  - KPI cards: Today's check-ins with SVG circular progress ring, sub-daily intervals count, top active streak, all-time record.
  - Bidirectional integration: Org-mode habits sync directly into HabitFlow intervals and streaks.

### 2.4 Progressive Web Application (PWA) & Web Storage Standards
- Modern PWA manifest (`manifest.webmanifest`) supporting standalone display, icons, and theme color.
- Service Worker registration (`sw.js`) for full offline availability, caching critical shell assets and fallback strategies.
- Storage layer:
  - Primary: IndexedDB for complete Org files (`tasks.org`, `habits.org`, `projects.org`, `archive.org`), revision logs, and clock records.
  - Secondary: localStorage for fast UI preferences (theme, audio mute, last active file).

### 2.5 Multi-User Collaboration & Firebase MFA Phone Linking Architecture
- Ready for **Firebase App Hosting** (`apphosting.yaml`, `firebase.json`).
- Personal vs. Shared Segregation:
  - Each user has their own private personal org-mode files stored securely under their UID.
  - Multi-user projects segregate a subset of org files, allowing granular sharing with specific Google users.
  - Collaboration features:
    - Invite collaborator by email address.
    - Add existing registered user (by name/email) to a specific project one-at-a-time.
- Mandatory Multi-Factor Authentication (MFA) via Firebase Phone Authentication:
  - Supported initial auth providers: Firebase Google Sign-In & Firebase Email/Password Authentication.
  - Security Requirement: Every registered user MUST have Firebase Phone Authentication linked as MFA.
  - Incomplete MFA Enforcement: If a user is registered or logs in without phone MFA, route guards immediately intercept and redirect them to an account linking registration view (`/link-phone`).
  - Phone MFA Linking Flow: Uses Firebase Phone Auth (`linkWithPhoneNumber` / RecaptchaVerifier) to complete the multi-factor enrollment, linking the SMS-verified phone credential to their existing Google or Email account before granting access to personal or collaborative org files.

## 3. Non-Functional Requirements
- **Framework**: Angular 22.0.x with standalone components, Signals (`signal`, `computed`, `effect`), and modern router guards.
- **Styling**: Tailwind CSS with custom glass-panel styling and CSS custom properties.
- **Reliability & Testing**: Jasmine/Karma unit tests covering Norang task state machine, agenda filtering, clocking calculations, habit streak logic, and Firebase MFA guards.
- **Build Quality**: Zero compilation warnings and successful production build via `ng build`.

## 4. Acceptance Criteria
- [ ] Angular >= 22 project initialized at `@./pivot/` using `ng new`.
- [ ] Comprehensive research document `pivot/RESEARCH_AND_FINDINGS.md` created detailing Norang features, shortcut mappings, storage, PWA, and Firebase MFA architecture.
- [ ] Norang org-mode state engine, agenda views, capture templates, clocking, refiling, and exporting implemented.
- [ ] HabitFlow Pro daily streaks and interval timers with Tone.js / Web Audio chimes fully operational.
- [ ] Browser-safe non-default keyboard shortcuts mapped and accessible via shortcut cheat sheet (`Alt+Shift+K`).
- [ ] PWA manifest and service worker configured for offline execution.
- [ ] Firebase Auth service, MFA guard, phone linking flow, and project collaboration service implemented with Firebase App Hosting configuration (`apphosting.yaml`).
- [ ] All unit tests pass and `ng build` builds cleanly.
