# Plan: High-Usability Web Speech API Voice Self-Documentation & Keyboard Enrollment UX Architecture (>=77% Satisfaction)

## Phase 1: Architectural Specification & UX Documentation
- [x] Task 1.1: Author comprehensive architectural and UX specification document (`pivot/docs/VOICE_SELF_DOCUMENTATION_UX.md`)
  - [x] Subtask 1.1.1: Detail quantitative usability benchmarks (>=77% SUS) across Cohort A (inexperienced voice users) and Cohort B (keyboard power users).
  - [x] Subtask 1.1.2: Specify Web Speech API architecture (`SpeechRecognition` & `SpeechSynthesis`), mobile audio unlock sequence, and error recovery states.
  - [x] Subtask 1.1.3: Detail zero-disruption floating Head-Up Display (HUD) model, preserving cursor position, buffer selection, and scroll state.
  - [x] Subtask 1.1.4: Define progressive keyboard enrollment loop: vocal response + keycap typography + interactive "Try Key" muscle memory drill.
  - [x] Subtask 1.1.5: Document canonical Norang GTD voice-to-shortcut intent mappings (clocking, capture, refile, agenda, states, babel, MFA).

## Phase 2: Core Voice Engine & Non-Disruptive Floating HUD Implementation
- [x] Task 2.1: Enhance `SelfDocumentationService` (`pivot/src/app/services/self-documentation.service.ts`)
  - [x] Subtask 2.1.1: Add reactive signals for non-disruptive floating HUD (`voiceHudVisible`, `hudShortcut`, `hudTimer`, `tryKeyMode`, `tryKeySuccess`).
  - [x] Subtask 2.1.2: Implement HUD auto-dismiss timer (4-second TTL) with pause-on-hover and instant barge-in cancellation on keypress.
  - [x] Subtask 2.1.3: Implement interactive "Try Key" chord validation engine to let users practice keyboard chords directly in the HUD.
- [x] Task 2.2: Implement floating Head-Up Display overlay in `App` component (`pivot/src/app/app.html` & `app.ts`)
  - [x] Subtask 2.2.1: Build `#voice-hud-overlay` floating card anchored to top-right with high-contrast keycaps, Norang rationale, and action buttons.
  - [x] Subtask 2.2.2: Add "Run Action" and "Try Key" interactive controls with live key chord detection.
  - [x] Subtask 2.2.3: Wire top navigation header microphone button `#btn-voice-assistant` to trigger non-disruptive floating HUD mode while preserving full manual modal tab.

## Phase 3: Comprehensive Test Suite & Regression Verification
- [x] Task 3.1: Update `self-documentation.service.spec.ts` with tests for floating HUD state, auto-dismiss, Try-Key chord validation, and barge-in speech cancellation.
- [x] Task 3.2: Update `app.spec.ts` with tests for HUD rendering, Run Action from HUD, Try-Key interaction, and zero-disruption keyboard events.
- [x] Task 3.3: Execute automated test suite (`npm test -- --watch=false`) and verify 100% pass rate.
- [x] Task 3.4: Execute production bundle build (`npx ng build`) and verify 0 errors / 0 warnings.

## Phase 4: Track Finalization & Registry Checkpoint
- [x] Task 4.1: Update track index (`conductor/tracks/voice_self_doc_ux_20261015/index.md`), metadata (`metadata.json`), and track registry (`conductor/tracks.md`).
- [x] Task 4.2: Commit changes to Git repository with descriptive commit message and auditable verification summary.
