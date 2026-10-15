# Implementation Plan: Norang Org-Mode PWA Integration with HabitFlow & Firebase MFA Phone Linking

## Phase 1: Research, Architecture & Project Scaffolding
- [ ] Task: Document in-depth research on Norang Org-Mode features, keyboard mapping, PWA standards, and Firebase MFA phone linking architecture
- [ ] Task: Scaffold Angular >= 22 application at `./pivot/` using `ng new` with standalone components and routing
- [ ] Task: Configure Tailwind CSS, web font assets, Tone.js/Web Audio integration, and PWA manifest in `./pivot/`
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Norang Org-Mode Engine & Precision Keyboard Shortcuts
- [ ] Task: Implement Norang task state machine (`TODO`, `NEXT`, `STARTED`, `WAITING`, `HOLD`, `DONE`, `CANCELLED`), fast selection, and transition logging
- [ ] Task: Implement Org Capture system (templates for Tasks, Habits, Notes, Phone Calls, Meetings) and Refiling engine
- [ ] Task: Implement Custom Agenda views (Daily/Weekly Schedule, NEXT Actions, Waiting/Hold, Stuck Projects) and Tag Filtering
- [ ] Task: Implement Time Clocking (Clock In/Out, history, default task, effort estimates, clock reports, overtime warning)
- [ ] Task: Implement Org-Babel code execution simulator, literate tangling, and document exporters (Markdown, HTML, CSV)
- [ ] Task: Implement browser-safe, non-default keyboard shortcuts manager (`Alt+Shift+*`, modal hotkeys, cheat sheet modal)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: HabitFlow Pro Integration & Progressive Web Application (PWA)
- [ ] Task: Integrate HabitFlow Pro dashboard (daily streaks, precision interval timers, Tone.js / Web Audio chimes, KPI cards) into Angular components
- [ ] Task: Connect HabitFlow interval and daily habits to Org-Mode habit AST and sync state
- [ ] Task: Implement client-side storage engine using IndexedDB for Org files/revisions and localStorage for UI preferences
- [ ] Task: Implement Service Worker and PWA offline caching with install banner support
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: Firebase Authentication, Mandatory Phone MFA Linking & Multi-User Collaboration
- [ ] Task: Implement Firebase Authentication service (Google Sign-In, Email/Password, phone MFA state tracking)
- [ ] Task: Implement mandatory Phone MFA Guard and Phone Linking registration flow (`/link-phone`) with account linking
- [ ] Task: Implement Multi-User Project Collaboration service (segregated personal vs shared org files, invite by email, add collaborator by name)
- [ ] Task: Configure Firebase App Hosting (`apphosting.yaml`, `firebase.json`) for production deployment
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Verification, Quality Assurance & Build
- [ ] Task: Write comprehensive unit test suites for Org engine, clocking, habit streaks, shortcuts, and MFA guards
- [ ] Task: Run automated tests, verify test coverage, and execute production build (`ng build`)
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
