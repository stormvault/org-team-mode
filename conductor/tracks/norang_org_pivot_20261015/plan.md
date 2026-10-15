# Implementation Plan: Norang Org-Mode PWA Integration with HabitFlow & Firebase MFA Phone Linking

## Phase 1: Research, Architecture & Project Scaffolding
- [x] Task: Document in-depth research on Norang Org-Mode features, keyboard mapping, PWA standards, and Firebase MFA phone linking architecture [26a4043]
- [x] Task: Scaffold Angular >= 22 application at `./pivot/` using `ng new` with standalone components and routing [26a4043]
- [x] Task: Configure Tailwind CSS, web font assets, Tone.js/Web Audio integration, and PWA manifest in `./pivot/` [26a4043]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [26a4043]

## Phase 2: Norang Org-Mode Engine & Precision Keyboard Shortcuts
- [x] Task: Implement Norang task state machine (`TODO`, `NEXT`, `STARTED`, `WAITING`, `HOLD`, `DONE`, `CANCELLED`), fast selection, and transition logging [8276beb]
- [x] Task: Implement Org Capture system (templates for Tasks, Habits, Notes, Phone Calls, Meetings) and Refiling engine [8276beb]
- [x] Task: Implement Custom Agenda views (Daily/Weekly Schedule, NEXT Actions, Waiting/Hold, Stuck Projects) and Tag Filtering [8276beb]
- [x] Task: Implement Time Clocking (Clock In/Out, history, default task, effort estimates, clock reports, overtime warning) [8276beb]
- [x] Task: Implement Org-Babel code execution simulator, literate tangling, and document exporters (Markdown, HTML, CSV) [8276beb]
- [x] Task: Implement browser-safe, non-default keyboard shortcuts manager (`Alt+Shift+*`, modal hotkeys, cheat sheet modal) [8276beb]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [8276beb]

## Phase 3: HabitFlow Pro Integration & Progressive Web Application (PWA)
- [x] Task: Integrate HabitFlow Pro dashboard (daily streaks, precision interval timers, Tone.js / Web Audio chimes, KPI cards) into Angular components [132c647]
- [x] Task: Connect HabitFlow interval and daily habits to Org-Mode habit AST and sync state [132c647]
- [x] Task: Implement client-side storage engine using IndexedDB for Org files/revisions and localStorage for UI preferences [132c647]
- [x] Task: Implement Service Worker and PWA offline caching with install banner support [132c647]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [132c647]

## Phase 4: Firebase Authentication, Mandatory Phone MFA Linking & Multi-User Collaboration
- [x] Task: Implement Firebase Authentication service (Google Sign-In, Email/Password, phone MFA state tracking) [fad53e1]
- [x] Task: Implement mandatory Phone MFA Guard and Phone Linking registration flow (`/link-phone`) with account linking [fad53e1]
- [x] Task: Implement Multi-User Project Collaboration service (segregated personal vs shared org files, invite by email, add collaborator by name) [fad53e1]
- [x] Task: Configure Firebase App Hosting (`apphosting.yaml`, `firebase.json`) for production deployment [fad53e1]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [fad53e1]

## Phase 5: Verification, Quality Assurance & Build
- [x] Task: Write comprehensive unit test suites for Org engine, clocking, habit streaks, shortcuts, and MFA guards [d4572f5]
- [x] Task: Run automated tests, verify test coverage, and execute production build (`ng build`) [d4572f5]
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) [d4572f5]
