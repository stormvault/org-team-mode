# Specification: Interactive Emacs-like Self-Documentation Manual, Keyboard-Driven Workflows & Web Speech API

## 1. Overview
This track delivers an interactive, Emacs-inspired self-documentation manual and keyboard-driven discovery system for the HabitFlow Org / Norang GTD Progressive Web Application (`pivot`). It maps a single primary UI entrypoint to both a dedicated keyboard binding (`?`, `F1`, and browser-safe `Alt + Shift + /` / `Alt + Shift + ?`) and a prominent question mark icon button (`?`) within the app top nav header, which overlays the application with a high-density interactive manual buffer (`*Norang Manual & Self-Documentation*`).

In addition, it wraps this self-documentation system with the **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition` and `SpeechSynthesis`), mapping a prominent microphone icon button (`🎤`) in the top nav header. This enables hands-free and mobile device users to speak natural language questions (e.g. *"Which keyboard shortcut should be used to clock in?"*, *"How do I capture a task?"*, *"How to change todo state to DONE?"*) and receive immediate textual answers and spoken audio feedback without touching a mouse or needing physical key chords.

In strict alignment with Bernt Hansen's canonical GTD system (`https://doc.norang.ca/org-mode.html` / `https://doc.norang.ca/org-mode.el`), every view in the application maximizes information density, ensuring every visual field is populated strictly with actionable or historically actionable data (such as tasks marked as `DONE`/`CANCELLED`, projects marked as blocked/stuck, active clocks, and refile inbox items).

## 2. Functional Requirements

### 2.1 Emacs-like Self-Documentation Engine
1. **`describe-bindings` (Keybindings Discovery)**:
   - Full categorized catalog of all shortcuts: Global chords (`Alt+Shift+*`), Modal Fast Keys (`t`, `n`, `s`, `w`, `h`, `d`, `c`), Capture template keys (`t`, `h`, `n`, `p`, `m`), Speed keys, and Navigation keys.
   - Real-time search/filter-as-you-type (`/` hotkey).
   - Category filtering (`All`, `Global`, `Org Capture`, `Agenda`, `Clocking`, `Navigation`).
   - "Run Action" execution directly from the manual buffer.
2. **`describe-key` (Interactive Key Inspector)**:
   - Interactive key detection mode (`d` hotkey in manual): Press any key or chord to display its binding, command action, parameters, and Norang workflow explanation.
3. **`where-is` / `describe-command` (Reverse Lookup)**:
   - Search by operation name or natural language description (e.g. "clock in", "refile", "change state", "agenda", "export", "mfa") to retrieve exact key sequences.
4. **Norang GTD Workflows Reference (`info` buffer)**:
   - Complete architectural documentation of Bernt Hansen's GTD flow:
     - Inboxing & Fleeting Capture (`refile.org`)
     - Refiling pipeline (`refile.org` -> `todo.org` / `projects.org` / `habits.org` / `archive.org`)
     - Norang 7-state TODO machine (`TODO`, `NEXT`, `STARTED`, `WAITING`, `HOLD`, `DONE`, `CANCELLED`)
     - Precision Clocking (`Alt+Shift+I` / `Alt+Shift+O`), Effort Estimates (`:Effort: 0:30`), and `CLOCKSUM` accounting
     - 5-Block Norang Custom Agenda & Stuck Projects Detection
     - Habits & Sub-daily Interval Timers
     - Literate Programming & Org-Babel code block execution
     - Zero-Trust Firebase Phone MFA Account Linking

### 2.2 UI Entrypoints & Navigation
1. **Prominent Top Nav Header Question Mark Button (`?`)**:
   - Styled prominently in the top header with clear badge and tooltip.
   - Clicking toggles the interactive manual overlay.
2. **Keyboard Entrypoints**:
   - `?` (when not in an input field), `F1`, and browser-safe `Alt + Shift + /` / `Alt + Shift + ?`.
3. **Keyboard-Driven Manual Control**:
   - `j` / `ArrowDown`: Move selection to next item/topic.
   - `k` / `ArrowUp`: Move selection to previous item/topic.
   - `1`, `2`, `3`, `4`: Switch directly between manual chapters (Keybindings, Norang GTD Workflows, Describe Key, Voice Assistant).
   - `Tab` / `Shift+Tab`: Cycle manual tabs.
   - `/`: Focus search input.
   - `Enter`: Trigger selected shortcut action or expand details.
   - `Escape` or `q`: Close manual overlay and return to active view.

### 2.3 Web Speech API Voice Assistant
1. **Prominent Top Nav Header Microphone Button (`🎤`)**:
   - Distinctive visual styling with pulse animation during listening.
   - Toggles voice recognition and activates the Voice Assistant manual buffer.
2. **Speech Recognition (`SpeechRecognition` / `webkitSpeechRecognition`)**:
   - Listens to user speech in real-time.
   - Displays live transcription.
   - Parses intent and queries the self-documentation engine for matching operations.
   - Answers: *"Which keyboard shortcut should be used to <operation>?"* with exact keys and Norang GTD explanation.
3. **Speech Synthesis (`SpeechSynthesis` / `SpeechSynthesisUtterance`)**:
   - Speaks concise answer back to user for hands-free and mobile clarity.
   - Supports mute/replay.
4. **Fallback & Robustness**:
   - Graceful fallback for mobile or browsers where microphone permission is denied or Web Speech API is absent (includes interactive text query box with one-click sample queries).

### 2.4 High Information Density & Bernt Hansen Agenda
1. Visual fields across all views maximize actionable and historically actionable data.
2. Norang Multi-Block Agenda displays:
   - Block 1: `NEXT` Actions List (immediately actionable items)
   - Block 2: Stuck Projects (projects without any active `NEXT` action)
   - Block 3: Waiting & Delegated Tasks (`WAITING`)
   - Block 4: On Hold / Paused / Blocked Tasks (`HOLD`) with resume guidance
   - Block 5: Action History & Completed Tasks (`DONE` and `CANCELLED`) with completion timestamps and total logged time
   - Block 6: Refile Inbox (`refile.org` tasks awaiting categorization)

## 3. Non-Functional Requirements
- **Framework**: Angular 22.0.x standalone architecture with reactive Signals (`signal`, `computed`).
- **Performance**: Zero external speech library dependencies; uses standard browser Web Speech API with safe degradation.
- **Verification**: 100% pass rate on unit tests (`npm test -- --watch=false`) and production build (`npx ng build`).
